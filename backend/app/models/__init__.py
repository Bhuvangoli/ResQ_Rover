"""SQLAlchemy model package — importing this registers all models with Base."""
from app.models.device import Device  # noqa: F401
from app.models.mission import Mission  # noqa: F401
from app.models.telemetry import Telemetry  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.blueprint import Blueprint  # noqa: F401
from app.models.observation import Observation  # noqa: F401
from app.models.media_asset import MediaAsset  # noqa: F401
from app.models.operator_note import OperatorNote  # noqa: F401
