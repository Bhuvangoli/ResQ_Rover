"""
UDP receiver for ESP32-WROOM one-way telemetry broadcasts.

Protocol
--------
  Source    : ESP32-WROOM, any IP on the local LAN
  Dest      : UDP broadcast 255.255.255.255 → port 4211
  Payload   : UTF-8 JSON, one object per datagram, ~500 ms interval
  ACKs      : none — fire and forget; we never transmit anything back

Required JSON fields (firmware contract — do not rename):
  device        str
  distanceCm    number
  pirMotion     bool
  gasRaw        number
  motorsRunning bool
  mode          str   "AUTO" | "STOP"

Optional JSON fields (accepted when present):
  wifiConnected  bool
  rssiDbm        number
  gasVoltage     number
  sensorReadings int

Design
------
  Runs on a dedicated daemon thread decoupled from the FastAPI event loop.
  After storing each valid packet in WroomState, it calls an asyncio
  callback (on_valid_packet) so the WebSocket manager can broadcast to
  connected dashboard clients without threading issues.
"""
from __future__ import annotations

import asyncio
import json
import logging
import socket
import threading
from typing import Callable, Optional

from .wroom_state import WroomState

logger = logging.getLogger("resq_rover.wroom")

UDP_HOST          = "0.0.0.0"
MAX_DATAGRAM_SIZE = 2048          # JSON packets are well under 1 KB
RECV_BUFFER_SIZE  = 512 * 1024   # 512 KB kernel receive buffer
SOCKET_TIMEOUT    = 1.0          # seconds; lets loop check self._running

# Fields that must be present and of the correct type.
_REQUIRED: list[tuple[str, type]] = [
    ("device",        str),
    ("distanceCm",    (int, float)),
    ("pirMotion",     bool),
    ("gasRaw",        (int, float)),
    ("motorsRunning", bool),
    ("mode",          str),
]


def _validate(packet: dict) -> bool:
    for field, expected in _REQUIRED:
        if field not in packet:
            return False
        if not isinstance(packet[field], expected):
            return False
    return True


class WroomUDPReceiver:
    """
    Lifecycle
    ---------
    Call start() once at application startup.
    Call stop() at application shutdown.
    start() is idempotent.
    """

    def __init__(
        self,
        state: WroomState,
        port: int,
        loop: Optional[asyncio.AbstractEventLoop] = None,
        on_valid_packet: Optional[Callable[[dict, str], None]] = None,
    ) -> None:
        """
        Parameters
        ----------
        state           : WroomState updated on each valid packet
        port            : UDP port to bind (4211)
        loop            : asyncio event loop for scheduling WS broadcasts;
                          captured at start() time if None here
        on_valid_packet : coroutine-creating callable(packet, sender_ip)
                          called after WroomState is updated; it must
                          return a coroutine that is safe to schedule via
                          asyncio.run_coroutine_threadsafe
        """
        self._state           = state
        self._port            = port
        self._loop            = loop
        self._on_valid_packet = on_valid_packet
        self._socket: Optional[socket.socket] = None
        self._thread: Optional[threading.Thread] = None
        self._running         = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        if self._running:
            return
        if loop is not None:
            self._loop = loop

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, RECV_BUFFER_SIZE)
        except OSError:
            pass  # non-fatal; OS may cap the value
        sock.bind((UDP_HOST, self._port))
        sock.settimeout(SOCKET_TIMEOUT)

        self._socket  = sock
        self._running = True
        self._thread  = threading.Thread(
            target=self._receive_loop,
            name="WroomUDPReceiver",
            daemon=True,
        )
        self._thread.start()
        logger.info("[WROOM UDP] Listening on %s:%d", UDP_HOST, self._port)

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
        logger.info("[WROOM UDP] Stopped.")

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _receive_loop(self) -> None:
        while self._running:
            try:
                raw, addr = self._socket.recvfrom(MAX_DATAGRAM_SIZE)
            except socket.timeout:
                continue
            except OSError:
                if self._running:
                    logger.warning("[WROOM UDP] Socket error — receiver stopping.")
                break
            except Exception as exc:
                logger.error("[WROOM UDP] Unexpected error: %s", exc)
                continue

            sender_ip = addr[0]

            # --- Parse ---
            try:
                packet = json.loads(raw.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                self._state.increment_invalid()
                logger.debug("[WROOM UDP] Malformed JSON from %s", sender_ip)
                continue

            if not isinstance(packet, dict):
                self._state.increment_invalid()
                continue

            # --- Validate required fields ---
            if not _validate(packet):
                self._state.increment_invalid()
                logger.debug("[WROOM UDP] Missing/wrong-type fields from %s: %s", sender_ip, list(packet.keys()))
                continue

            # --- Store ---
            self._state.update(packet, sender_ip)

            # --- Schedule WebSocket broadcast on the event loop ---
            if self._on_valid_packet is not None and self._loop is not None:
                try:
                    coro = self._on_valid_packet(packet, sender_ip)
                    asyncio.run_coroutine_threadsafe(coro, self._loop)
                except Exception as exc:
                    logger.error("[WROOM UDP] Broadcast scheduling error: %s", exc)
