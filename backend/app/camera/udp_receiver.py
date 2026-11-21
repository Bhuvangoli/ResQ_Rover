"""
UDP receiver for ESP32-CAM MJPEG broadcast stream.

Binds to 0.0.0.0:<port> and reads datagrams on a dedicated daemon thread.
Parsed packets are handed to FrameReassembler; completed frames are published
to LatestFrameStore.

The receiver is intentionally decoupled from FastAPI's asyncio event loop so
that packet processing never blocks HTTP request handling.
"""
from __future__ import annotations

import logging
import socket
import threading
from typing import Optional

from .frame_reassembler import FrameReassembler
from .frame_store import LatestFrameStore

logger = logging.getLogger("resq_rover.camera")

UDP_HOST         = "0.0.0.0"
MAX_DATAGRAM_SIZE = 1200          # firmware sends at most ~1200 bytes per packet
RECV_BUFFER_SIZE  = 2 * 1024 * 1024   # 2 MB kernel receive buffer
SOCKET_TIMEOUT    = 1.0          # seconds; lets the loop check self._running


class CameraUDPReceiver:
    """
    Lifecycle: call start() once; call stop() on application shutdown.
    start() is idempotent — calling it again while running is a no-op.
    """

    def __init__(self, frame_store: LatestFrameStore, port: int) -> None:
        self._frame_store   = frame_store
        self._port          = port
        self._reassembler   = FrameReassembler()
        self._socket: Optional[socket.socket] = None
        self._thread: Optional[threading.Thread] = None
        self._running       = False

        # Counters
        self.packets_received = 0
        self.socket_errors    = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._running:
            return

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # SO_REUSEADDR lets us restart quickly without "address in use" errors
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Large kernel buffer absorbs short bursts when Python is busy
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, RECV_BUFFER_SIZE)
        except OSError:
            pass  # non-fatal; OS may cap the value

        sock.bind((UDP_HOST, self._port))
        sock.settimeout(SOCKET_TIMEOUT)
        self._socket  = sock
        self._running = True

        self._thread = threading.Thread(
            target=self._receive_loop,
            name="CameraUDPReceiver",
            daemon=True,          # does not prevent interpreter exit
        )
        self._thread.start()

        logger.info("[CAMERA UDP] Listening on %s:%d", UDP_HOST, self._port)

    def stop(self) -> None:
        self._running = False
        if self._socket:
            try:
                self._socket.close()
            except OSError:
                pass
            self._socket = None
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        logger.info("[CAMERA UDP] Stopped.")

    def get_stats(self) -> dict:
        return {
            "port":             self._port,
            "running":          self._running,
            "packets_received": self.packets_received,
            "socket_errors":    self.socket_errors,
            **self._reassembler.get_stats(),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _receive_loop(self) -> None:
        while self._running:
            try:
                datagram, _addr = self._socket.recvfrom(MAX_DATAGRAM_SIZE)
            except socket.timeout:
                continue               # check self._running and loop back
            except OSError:
                # Socket was closed by stop(); exit cleanly
                if self._running:
                    self.socket_errors += 1
                    logger.warning("[CAMERA UDP] Socket error — receiver stopping.")
                break
            except Exception as exc:
                logger.error("[CAMERA UDP] Unexpected error: %s", exc)
                continue

            self.packets_received += 1

            result = self._reassembler.process_packet(datagram)
            if result is not None:
                frame_id, jpeg = result
                self._frame_store.publish(frame_id, jpeg)
