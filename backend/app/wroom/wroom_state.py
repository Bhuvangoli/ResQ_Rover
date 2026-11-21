"""
In-memory store for the latest WROOM telemetry packet.

Thread-safe: written by the UDP receiver thread, read by FastAPI coroutines.

Freshness thresholds
--------------------
  LIVE    — last packet arrived within 1.5 s
  STALE   — last packet arrived 1.5–5 s ago
  OFFLINE — no packet received yet, or last packet > 5 s ago
"""
from __future__ import annotations

import threading
import time
from typing import Optional

LIVE_THRESHOLD  = 1.5   # seconds
STALE_THRESHOLD = 5.0   # seconds


class WroomState:
    """Single-writer, many-reader telemetry state store."""

    def __init__(self) -> None:
        self._lock               = threading.Lock()
        self._latest: Optional[dict] = None
        self._received_at: Optional[float] = None   # time.time() of last valid packet
        self._sender_addr: Optional[str]  = None
        self.packets_received    = 0
        self.invalid_packets     = 0

    # ------------------------------------------------------------------
    # Writer — called from UDP receiver thread
    # ------------------------------------------------------------------

    def update(self, packet: dict, sender_addr: str) -> None:
        with self._lock:
            self._latest      = packet
            self._received_at = time.time()
            self._sender_addr = sender_addr
            self.packets_received += 1

    def increment_invalid(self) -> None:
        with self._lock:
            self.invalid_packets += 1

    # ------------------------------------------------------------------
    # Readers — called from FastAPI / WebSocket coroutines
    # ------------------------------------------------------------------

    def get_latest(self) -> Optional[dict]:
        """Return a shallow copy of the latest packet, or None."""
        with self._lock:
            return dict(self._latest) if self._latest else None

    def get_freshness(self) -> str:
        """Return 'live', 'stale', or 'offline'."""
        with self._lock:
            return self._freshness()

    def get_status(self) -> dict:
        """Diagnostic snapshot for GET /api/telemetry/status."""
        with self._lock:
            age = None
            if self._received_at is not None:
                age = round(time.time() - self._received_at, 3)
            return {
                "has_data":                self._latest is not None,
                "freshness":               self._freshness(),
                "last_received_at":        self._received_at,
                "last_packet_age_seconds": age,
                "packets_received":        self.packets_received,
                "invalid_packets":         self.invalid_packets,
                "last_sender":             self._sender_addr,
            }

    # ------------------------------------------------------------------
    # Private helpers — must be called while lock is held
    # ------------------------------------------------------------------

    def _freshness(self) -> str:
        if self._received_at is None:
            return "offline"
        age = time.time() - self._received_at
        if age <= LIVE_THRESHOLD:
            return "live"
        if age <= STALE_THRESHOLD:
            return "stale"
        return "offline"
