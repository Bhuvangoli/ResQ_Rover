j# ResQ Rover — Development Guide

## Prerequisites

- Python 3.10+ (tested on 3.13)
- Node.js 18+ and npm (tested on Node 22, npm 11)

## Project Structure

```
ResQ_Rover/
├── backend/           Python FastAPI backend
│   ├── app/           Application code
│   ├── tests/         pytest tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/          React + Vite dashboard
│   ├── src/           Application source
│   └── package.json
├── storage/           Local file storage (not committed)
│   ├── blueprints/
│   ├── images/snapshots/
│   ├── recordings/
│   ├── exports/
│   └── logs/
├── vision/            Optional OpenCV module
└── docs/              Documentation
```

## Backend Setup

```bash
cd ResQ_Rover/backend

# Create virtual environment
python3 -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1
# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env as needed

# Start backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Backend URL:** `http://127.0.0.1:8000`
**API docs:** `http://127.0.0.1:8000/docs`

## Frontend Setup

```bash
cd ResQ_Rover/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Frontend URL:** `http://localhost:5173`

## Running Tests

### Backend

```bash
cd ResQ_Rover/backend
.venv\Scripts\python.exe -m pytest tests/ -v
```

### Frontend

```bash
cd ResQ_Rover/frontend
npm test
```

### Production Build

```bash
cd ResQ_Rover/frontend
npm run build
# Output in dist/
```

## Environment Variables

See `backend/.env.example` for all options:

| Variable | Default | Description |
|---|---|---|
| `HARDWARE_MODE` | `simulation` | `simulation` or `real` |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `8000` | Server port |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed CORS origins |
| `DATABASE_URL` | `sqlite+pysqlite:///:memory:` | Do not change for prototype |
| `TELEMETRY_STALE_AFTER_MS` | `15000` | Stale threshold |
| `CAMERA_STREAM_URL` | (empty) | Camera MJPEG URL if available |
| `STORAGE_ROOT` | `../storage` | File storage root path |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

## Hardware Mode

```env
# Run without hardware (default)
HARDWARE_MODE=simulation

# Real hardware (disables simulator)
HARDWARE_MODE=real
```

## Adding the Real Hardware Adapter

1. Create `app/adapters/real_adapter.py`
2. Implement the same interface as the simulator
3. Parse hardware packets into `TelemetryIngest` schema objects
4. Call `telemetry_service.ingest()` — same as simulator
5. Set `HARDWARE_MODE=real` and restart backend

See `docs/HARDWARE_INTEGRATION.md` for the full data contract.

## Important Caveats

- **In-memory database**: All rows are lost on backend restart.
- **Simulator data**: All readings in simulation mode are labeled `sourceMode: "simulated"`.
- **No certified safety assessment**: The hazard/alert system is a prototype indicator.
- **Camera not yet integrated**: Firmware does not expose a stream endpoint yet.
- **Motor commands disabled**: Not safe to implement without hardware verification.
