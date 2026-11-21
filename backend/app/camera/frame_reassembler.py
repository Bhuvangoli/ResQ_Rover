"""
Frame reassembler for the ESP32-CAM UDP packet protocol.

Packet header layout (little-endian, 20 bytes):
  uint32  magic         0x52514356  "RQCV"
  uint8   version       1
  uint8   flags         reserved
  uint16  header_size   must equal HEADER_SIZE (20)
  uint32  frame_id      monotonically increasing on camera
  uint16  packet_index  0-based index within this frame
  uint16  packet_count  total packets in this frame
  uint32  frame_length  total JPEG byte length

Payload follows immediately after the header.
Maximum payload per packet: MAX_PAYLOAD_BYTES (1180).

A JPEG is published only after every expected packet has arrived.
Frames that do not complete within FRAME_TIMEOUT seconds are discarded.
"""
from __future__ import annotations

import struct
import time
import threading
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Protocol constants — must match firmware exactly
# ---------------------------------------------------------------------------
PACKET_HEADER = struct.Struct("<IBBHIHHI")
MAGIC = 0x52514356
VERSION = 1
HEADER_SIZE = PACKET_HEADER.size          # 20 bytes
assert HEADER_SIZE == 20, f"Expected 20-byte header, got {HEADER_SIZE}"

MAX_PAYLOAD_BYTES    = 1180               # maximum payload per packet
MAX_PACKET_COUNT     = 1000              # sanity cap on packets-per-frame
MAX_FRAME_SIZE       = 1024 * 1024       # 1 MB absolute cap on JPEG size
MAX_INCOMPLETE_FRAMES = 8               # concurrent in-flight frames kept
FRAME_TIMEOUT        = 1.5              # seconds before an incomplete frame is discarded


# ---------------------------------------------------------------------------
# In-flight frame state
# ---------------------------------------------------------------------------
@dataclass
class FrameAssembly:
    frame_id: int
    packet_count: int
    frame_length: int
    packets: Dict[int, bytes] = field(default_factory=dict)
    created_at: float = field(default_factory=time.monotonic)
    received_bytes: int = 0


# ---------------------------------------------------------------------------
# Reassembler
# ---------------------------------------------------------------------------
class FrameReassembler:
    """
    Thread-safe packet reassembler.

    Call process_packet(datagram) from any thread.
    Returns (frame_id, jpeg_bytes) when a frame is complete, None otherwise.
    """

    def __init__(self) -> None:
        self._frames: Dict[int, FrameAssembly] = {}
        self._lock = threading.Lock()

        # Counters — read via get_stats()
        self.frames_completed  = 0
        self.frames_discarded  = 0
        self.duplicate_packets = 0
        self.invalid_packets   = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_packet(self, datagram: bytes) -> Optional[Tuple[int, bytes]]:
        """
        Parse one UDP datagram and return a completed frame or None.

        All validation happens before any buffer allocation.
        """
        # 1. Minimum length check
        if len(datagram) < HEADER_SIZE:
            self.invalid_packets += 1
            return None

        # 2. Header decode
        try:
            (
                magic,
                version,
                flags,
                header_size,
                frame_id,
                packet_index,
                packet_count,
                frame_length,
            ) = PACKET_HEADER.unpack_from(datagram)
        except struct.error:
            self.invalid_packets += 1
            return None

        # 3. Magic / version
        if magic != MAGIC or version != VERSION:
            self.invalid_packets += 1
            return None

        # 4. Header size field must match our compile-time constant
        if header_size != HEADER_SIZE:
            self.invalid_packets += 1
            return None

        # 5. Payload must be non-empty and within the per-packet limit
        payload = datagram[HEADER_SIZE:]
        if not payload or len(payload) > MAX_PAYLOAD_BYTES:
            self.invalid_packets += 1
            return None

        # 6. Packet / frame sanity
        if packet_count == 0 or packet_count > MAX_PACKET_COUNT:
            self.invalid_packets += 1
            return None
        if packet_index >= packet_count:
            self.invalid_packets += 1
            return None
        if frame_length <= 0 or frame_length > MAX_FRAME_SIZE:
            self.invalid_packets += 1
            return None

        # 7. All pre-allocation checks passed — enter the critical section
        with self._lock:
            self._evict_expired()

            frame = self._frames.get(frame_id)

            if frame is None:
                # Evict the oldest in-flight frame if the buffer is full
                if len(self._frames) >= MAX_INCOMPLETE_FRAMES:
                    oldest_id = min(self._frames, key=lambda k: self._frames[k].created_at)
                    del self._frames[oldest_id]
                    self.frames_discarded += 1

                frame = FrameAssembly(
                    frame_id=frame_id,
                    packet_count=packet_count,
                    frame_length=frame_length,
                )
                self._frames[frame_id] = frame

            # 8. Consistency: a later packet must agree with the first
            if frame.packet_count != packet_count or frame.frame_length != frame_length:
                self.invalid_packets += 1
                return None

            # 9. Duplicate detection
            if packet_index in frame.packets:
                self.duplicate_packets += 1
                return None

            frame.packets[packet_index] = payload
            frame.received_bytes += len(payload)

            # 10. Not all packets present yet
            if len(frame.packets) != frame.packet_count:
                return None

            # 11. All packets received — assemble in index order
            jpeg = b"".join(frame.packets[i] for i in range(frame.packet_count))
            del self._frames[frame_id]

            # 12. Byte-length sanity
            if len(jpeg) != frame.frame_length:
                self.frames_discarded += 1
                return None

            # 13. JPEG magic bytes (SOI / EOI)
            if not jpeg.startswith(b"\xff\xd8") or not jpeg.endswith(b"\xff\xd9"):
                self.frames_discarded += 1
                return None

            self.frames_completed += 1
            return frame_id, jpeg

    def get_stats(self) -> dict:
        with self._lock:
            return {
                "incomplete_frames":  len(self._frames),
                "frames_completed":   self.frames_completed,
                "frames_discarded":   self.frames_discarded,
                "duplicate_packets":  self.duplicate_packets,
                "invalid_packets":    self.invalid_packets,
            }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _evict_expired(self) -> None:
        """Remove frames that have not completed within FRAME_TIMEOUT."""
        now = time.monotonic()
        expired = [
            fid for fid, f in self._frames.items()
            if now - f.created_at > FRAME_TIMEOUT
        ]
        for fid in expired:
            del self._frames[fid]
            self.frames_discarded += 1
