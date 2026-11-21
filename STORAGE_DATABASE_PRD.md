# ResQ Rover --- Storage and Database PRD

**ORM:** SQLAlchemy 2.x
**Database engine:** in-memory SQLite (`sqlite+pysqlite:///:memory:`)
**Storage root:** `ResQ_Rover/storage/`

## 1. Objective

Define prototype data models and safe local file storage for mission data,
telemetry, alerts, observations, camera snapshots, recordings, uploaded
building plans and application logs. SQLAlchemy 2.x is the ORM; in-memory
SQLite is the database engine. This is deliberately ephemeral: all database
rows are lost when the backend process exits or restarts. Large binary assets
are stored as files, not database blobs.

## 2. Directory structure

```text
storage/
├── blueprints/
├── images/
│   └── snapshots/
├── recordings/
├── exports/
└── logs/
```

The backend creates required directories at startup. Do not create a database
file, configure a persistent SQLite URL, enable WAL, or commit runtime media
or logs to Git. Local files may remain after process restart, but the
in-memory database metadata will not; handle orphaned files conservatively.

## 3. Database engine and SQLAlchemy configuration

Use SQLAlchemy 2.x typed declarative models and a single application-scoped
engine. For SQLite in-memory mode, configure a shared connection so sessions
in different request threads see the same database:

```python
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

DATABASE_URL = "sqlite+pysqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

# During FastAPI application startup:
Base.metadata.create_all(bind=engine)
```

Create one Session per request/task and always close it. Commit writes at
service transaction boundaries and roll back on exceptions. Use SQLAlchemy
`select()` statements and explicit relationships. Do not use a database
file, Alembic migration chain, WAL mode or backup instructions for this
in-memory prototype. A schema change is reflected by the code's metadata and
fresh schema initialization on process start.

## 4. Database entities

The following logical entities and fields preserve the source requirements.
Use UUID/string identifiers or integer primary keys consistently; document
the selected type and serialization format in implementation. Foreign-key
relationships should be declared where both entities exist.

### devices
- `id` primary key
- `device_id` unique
- `name`, `device_type`
- `firmware_version` nullable
- `last_seen_at`, `status`, `created_at`

### missions
- `id` primary key
- `name`, `description` nullable
- `building_id` nullable
- `status` (planned, active, completed, aborted)
- `started_at`, `ended_at` nullable, `created_at`

### telemetry
- `id` primary key
- `device_id` foreign key/reference to device
- `mission_id` nullable foreign key/reference
- `device_timestamp`, `received_at`
- `sequence` nullable
- `temperature_c`, `mq2_raw`, `distance_cm`, `motion_detected` nullable
- `battery_percent`, `battery_voltage`, `rssi_dbm` nullable
- `raw_payload_json`
- `source_mode` (real/simulated)

### alerts
- `id` primary key
- `mission_id`, `device_id` nullable references
- `rule_id`, `severity`, `title`, `description`
- `trigger_value_json`, `threshold_json`
- `status` (active, acknowledged, resolved)
- `created_at`, `acknowledged_at` nullable, `resolved_at` nullable

### blueprints
- `id` primary key
- `name`, `file_name`, `mime_type`
- `width_px`, `height_px`
- `building_id` nullable
- `created_at`
- relative storage key for the uploaded image

### observations
- `id` primary key
- `mission_id` reference
- `blueprint_id` nullable reference
- `type`, `severity` nullable, `label`, `description` nullable
- `x_normalized`, `y_normalized` nullable
- `location_method` (manual, estimated, localized, unknown)
- `source_event_id` nullable, `created_at`

Normalized coordinates are 0--1 relative to the displayed blueprint. Do not
store exact coordinates unless operator places them or localization provides
them.

### media_assets
- `id` primary key
- `mission_id`, `device_id` nullable references
- `media_type` (snapshot, recording, blueprint)
- `file_name`, `mime_type`, `size_bytes`
- `captured_at` nullable, `created_at`
- `metadata_json`
- relative storage key

### operator_notes
- `id` primary key
- `mission_id` reference
- `observation_id` nullable reference
- `note`, `created_at`

## 5. File storage

Generate server-side UUID filenames; preserve original filename only as
sanitized metadata. Validate MIME type and file signature. Enforce file-size
limits. Never accept arbitrary absolute paths from clients. Store only
relative storage keys in database. Resolve paths against configured storage
root and prevent path traversal. Use streaming for large file downloads.
Return media through controlled API endpoints.

## 6. Retention, cleanup and prototype data lifecycle

Retention periods for snapshots, recordings and logs are configurable.
Default to retaining mission media files until operator deletes/archives
them during prototype testing. Provide a cleanup utility with dry-run mode.
Do not delete evidence automatically without an explicitly configured policy.

Important database limitation: mission, telemetry, alert, device and media
metadata rows exist only for the lifetime of the backend process. Restarting
the backend creates an empty in-memory database. Filesystem media may still
exist but can become orphaned. Do not promise persistence across restart,
database backups or restoration. Durable mission history requires a separate
approved database decision and is outside this finalized stack.

## 7. Export and querying

Support mission telemetry CSV, mission event/alert CSV, mission summary JSON
and optional ZIP containing selected snapshots and summary. Exports must
include units, timestamps, source mode and sensor identifiers. Clearly mark
simulated data. Paginate history queries and index relevant foreign-key and
timestamp columns within the in-memory schema for runtime query efficiency.

## 8. Privacy and security

Do not commit stored media or logs to public Git. Do not expose storage root
paths. Restrict uploads to expected image types and size limits. Add deletion
controls for media and missions with confirmation. Keep logs free of secrets
and unnecessary personal data.

## 9. Acceptance criteria

- SQLAlchemy 2.x models and sessions initialize the in-memory SQLite schema.
- Foreign keys and indexes are configured.
- Rows are queryable across requests during one backend process.
- Database rows are lost on restart and this limitation is visible in README/UI
  or developer-facing documentation.
- Uploaded blueprints and snapshots are stored safely as files.
- Exports include correct metadata and units.
- Cleanup supports dry-run and does not delete by default.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
