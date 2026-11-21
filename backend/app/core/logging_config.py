"""Structured logging configuration."""
from __future__ import annotations

import logging
import sys
from app.core.settings import settings


def configure_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    logging.basicConfig(stream=sys.stdout, level=level, format=fmt)
    # Silence noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


logger = logging.getLogger("resq_rover")
