"""
Latest-frame store.

Holds exactly one complete JPEG at a time.
publish() replaces whatever was there; get_latest() returns a snapshot dict.
Thread-safe; designed for one writer (UDP receiver thread) and many readers
(MJPEG generator coroutines).

Frame-ID wraparound note
------------------------
frame_id is a uint32 from the ESP32.  At ~30 fps it wraps after ~16 weeks of
continuous operation, which is acceptable for this prototype.  publish() always
replaces the stored frame unconditionally; a delayed out-of-order frame from an
earlier reassembly window could theoretically overwrite a newer one, but only
if the two frame IDs are within the same FRAME_TIMEOUT window — which the
reassembler already bounds to 1.5 s.
"""
from __future__ import annotations

import threading
import time
from typing import Optional


class LatestFrameStore:
    def __init__(self) -> None:
        self._lock      = threading.Lock()
        self._jpeg:      Optional[bytes] = None
        self._frame_id:  Optional[int]   = None
        self._timestamp: Optional[float] = None
        self.total_frames = 0

    def publish(self, frame_id: int, jpeg: bytes) -> None:
        with self._lock:
            self._jpeg      = jpeg
            self._frame_id  = frame_id
            self._timestamp = time.time()
            self.total_frames += 1

    def get_latest(self) -> Optional[dict]:
        with self._lock:
            if self._jpeg is None:
                return None
            return {
                "frame_id":  self._frame_id,
                "jpeg":      self._jpeg,
                "timestamp": self._timestamp,
            }

    def get_stats(self) -> dict:
        with self._lock:
            age = None
            if self._timestamp is not None:
                age = round(time.time() - self._timestamp, 3)
            return {
                "has_frame":              self._jpeg is not None,
                "frame_id":               self._frame_id,
                "total_frames":           self.total_frames,
                "last_frame_age_seconds": age,
            }
