from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BlueprintOut(BaseModel):
    id: str
    name: str
    fileName: str
    mimeType: str
    widthPx: Optional[int] = None
    heightPx: Optional[int] = None
    buildingId: Optional[str] = None
    createdAt: datetime

    model_config = {"from_attributes": True}
