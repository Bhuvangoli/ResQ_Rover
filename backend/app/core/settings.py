"""Application settings loaded from environment / .env file."""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    DATABASE_URL: str = "sqlite+pysqlite:///:memory:"
    TELEMETRY_STALE_AFTER_MS: int = 15000
    CAMERA_STREAM_URL: str = ""
    CAMERA_UDP_PORT: int = 4210        # UDP port the ESP32-CAM broadcasts to
    CAMERA_UDP_ENABLED: bool = True    # set False to disable the camera UDP receiver
    WROOM_UDP_PORT: int = 4211         # UDP port the ESP32-WROOM broadcasts telemetry to
    WROOM_UDP_ENABLED: bool = True     # set False to disable the WROOM telemetry receiver
    DEVICE_API_KEY: str = ""
    STORAGE_ROOT: str = "../storage"
    LOG_LEVEL: str = "INFO"
    HARDWARE_MODE: str = "simulation"  # "simulation" | "real"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        p = (base / self.STORAGE_ROOT).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
