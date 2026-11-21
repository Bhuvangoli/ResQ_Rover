# Instructions for Coding Agents --- ResQ Rover

You are implementing ResQ Rover in the `ResQ_Rover/` directory. Read
`PRD_OVERVIEW.md`, this document and the relevant component PRD before
changing code. These updated PRDs define the approved implementation stack.

## Mandatory technology rules

- Frontend: React.js + Vite.
- Styling: Tailwind CSS.
- Backend: Python 3 + FastAPI + Pydantic.
- ORM: SQLAlchemy 2.x.
- Database: in-memory SQLite only (`sqlite+pysqlite:///:memory:`).
- Real-time: FastAPI WebSockets; do not use Socket.IO.
- Charts: Recharts.
- Rover/floor-plan rendering: SVG and/or HTML Canvas.
- OpenCV is optional. YOLO is optional, future-only and disabled by default.
- Do not introduce Node.js or Express as backend technologies.
- Do not introduce PostgreSQL, MongoDB, MySQL, a persistent SQLite file or
  another database unless a separately approved decision changes this PRD.

SQLAlchemy is an ORM, not the database engine. The selected database engine
is SQLite in memory. All database rows are lost when the backend process
restarts; never claim durable mission history in this prototype.

## Mandatory workflow

1. Inspect the existing directory tree and files before editing.
2. Preserve the sibling `TBP_Project/` PlatformIO firmware directory. Do not
   move, rename, delete or rewrite it.
3. Do not assume hardware features that are not present in the supplied
   firmware.
4. Implement one milestone at a time. Summarize changed files and commands.
5. Run frontend lint/tests/build and backend pytest checks that are available.
   Report failures honestly.
6. Do not claim physical hardware testing unless it was actually performed.
7. Keep configuration in environment variables and provide `.env.example`.
8. Update README whenever commands, endpoints or configuration change.
9. Do not install unnecessary dependencies or introduce cloud services.
10. Do not add AI/YOLO as a required dependency.
11. Preserve all functional requirements, sensor meanings and hardware
    constraints from the other PRDs.

## Suggested repository structure

```text
ResQ_Rover/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/       # REST client and WebSocket client
│   │   ├── charts/
│   │   └── map/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── realtime/
│   │   ├── adapters/
│   │   ├── simulator/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── vision/                 # optional OpenCV module; not required to boot
├── storage/                # local media, exports and logs; no DB file
└── README.md
```

## Dependency baseline

Backend required packages (use compatible current versions):
- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy>=2,<3`
- `pydantic`
- `pydantic-settings`
- `python-multipart` (file uploads)
- `pytest` and `httpx` (development/test)

Add a serial adapter dependency only if USB serial is selected and hardware
details are confirmed. Do not add OpenCV or YOLO to the required dependency
file. Optional vision extras may include `opencv-python`; optional YOLO
packages and model weights require explicit approval.

Frontend required packages:
- `react`, `react-dom`, `vite`
- `tailwindcss` and the Vite-compatible Tailwind integration for the selected
  Tailwind major version
- `recharts`
- a test stack such as `vitest` and `@testing-library/react`

Use the native browser `WebSocket` API; no Socket.IO client package.

## Development setup and execution

Backend (from `ResQ_Rover/backend/`):

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend (from `ResQ_Rover/frontend/`):

```bash
npm install
npm run dev
```

Node/npm are used only as the Vite frontend toolchain/package manager. They
must not host or implement the backend. Document production build commands
using the scripts actually present in `package.json`; do not invent scripts.

FastAPI interactive API documentation is available at `/docs`; OpenAPI JSON
is available at `/openapi.json`. Backend REST base URL defaults to
`http://127.0.0.1:8000`; WebSocket base URL defaults to
`ws://127.0.0.1:8000/api/ws`.

## Implementation order

### Task 1 --- repository foundation
- Inspect existing files and firmware first.
- Initialize React + Vite frontend in `frontend/`; configure Tailwind CSS.
- Initialize Python/FastAPI backend in `backend/`.
- Configure SQLAlchemy 2.x with shared-connection in-memory SQLite.
- Add `/api/health`, `.env.example`, root README and `.gitignore`.
- Confirm both apps start locally and health responds.

### Task 2 --- simulator and real-time dashboard
- Build a clearly labelled simulator using the same telemetry schema as real
  hardware.
- Add Pydantic validation and SQLAlchemy insertion.
- Broadcast accepted telemetry over FastAPI WebSockets.
- Build dashboard cards and Recharts visualizations.
- Verify real and simulated data are visually distinguishable.

### Task 3 --- missions, alerts and storage
- Implement SQLAlchemy models and schema initialization using
  `Base.metadata.create_all`.
- Implement mission lifecycle, configurable threshold rules and alert
  acknowledgement.
- Add blueprint upload, manual markers, mission history and CSV/JSON export.
- Clearly communicate that DB rows are process-lifetime only; local files are
  separate and may outlive metadata.

### Task 4 --- hardware integration
- Re-read `INTEGRATION_COMMUNICATION_PRD.md`.
- Inspect current firmware and ask for missing hardware/transport details
  before making firmware changes.
- Implement only the agreed transport and route all accepted readings through
  the shared telemetry service.
- Keep simulator working as fallback.
- Never assume current camera firmware provides a live stream.

### Task 5 --- camera and vision
- First implement camera status and snapshot handling.
- Add a JPEG/MJPEG stream only after the firmware endpoint is implemented
  and tested.
- Add OpenCV only as an optional extra/module.
- YOLO is optional, disabled by default and not part of initial acceptance.

## Code quality requirements

- Use small modules with clear responsibilities.
- Validate all external input with Pydantic/domain validation.
- Use consistent JSON error response shapes.
- Add tests for core calculations and ingestion.
- Avoid hard-coded machine-specific paths.
- Keep timestamps in UTC internally.
- Use explicit units in field names.
- Avoid silently converting raw sensor values into physical units.
- Do not display missing values as zero.
- Bound in-memory queues and chart history.
- Provide loading, offline, stale and error states.
- Keep WebSocket event delivery separate from REST history retrieval.
- Never treat WebSocket delivery as durable or guaranteed.

## Definition of done for each task

A task is complete only when implementation matches the PRDs, relevant tests
and build checks pass, setup/test instructions are documented, no unrelated
firmware/project files were modified, and limitations/unverified hardware
assumptions are listed.

## Technology-stack authority

This updated PRD is part of the revised ResQ Rover documentation set. For
technology and implementation choices, follow the approved stack: React.js +
Vite, Tailwind CSS, Python + FastAPI, SQLAlchemy 2.x with in-memory SQLite,
FastAPI WebSockets, Recharts, and SVG/HTML Canvas. OpenCV and YOLO are
optional. This supersedes conflicting technology references in any earlier
revision of the PRDs. Preserve original product behavior and hardware facts.
