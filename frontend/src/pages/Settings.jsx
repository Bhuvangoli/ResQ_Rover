import React, { useState } from 'react'
import { CheckCircle, AlertCircle, RefreshCw, Info } from 'lucide-react'
import { getHealth } from '../services/api'

export default function Settings({ wsStatus }) {
  const [apiUrl, setApiUrl] = useState(window.location.origin)
  const [cameraUrl, setCameraUrl] = useState('')
  const [staleSecs, setStaleSecs] = useState(15)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await getHealth()
      setTestResult({ ok: true, data: r.data })
    } catch (err) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connection and display configuration</p>
      </div>

      {/* Important notices */}
      <div className="card border-blue-700/40 bg-blue-950/10">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300 space-y-1">
            <p>Settings below are for display/testing purposes in this session. Persistent configuration lives in the backend <code>.env</code> file.</p>
            <p>Never store credentials or API keys in browser local storage.</p>
          </div>
        </div>
      </div>

      {/* Backend connection */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Backend Connection</h2>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Backend REST Base URL</label>
          <input
            type="text"
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
            readOnly
          />
          <p className="text-xs text-slate-600 mt-1">Configured via Vite proxy. See vite.config.js to change.</p>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">WebSocket URL</label>
          <input
            type="text"
            value={`ws://${window.location.host}/api/ws`}
            readOnly
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={testConnection}
            disabled={testing}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            Test Connection
          </button>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {testResult.ok
                ? `Connected — v${testResult.data?.version || '?'}, mode: ${testResult.data?.hardwareMode}`
                : testResult.error}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">WebSocket Status</label>
          <div className={`text-sm font-medium capitalize ${
            wsStatus === 'connected' ? 'text-green-400' :
            wsStatus === 'reconnecting' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {wsStatus || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Camera settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Camera</h2>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Camera Stream URL</label>
          <input
            type="text"
            value={cameraUrl}
            onChange={e => setCameraUrl(e.target.value)}
            placeholder="http://192.168.1.100/stream"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          />
          <p className="text-xs text-slate-600 mt-1">
            Requires MJPEG or compatible stream. Configure <code>CAMERA_STREAM_URL</code> in backend .env for persistence.
          </p>
        </div>
        <div className="card border-yellow-700/40 bg-yellow-950/10 py-2">
          <p className="text-xs text-yellow-300">
            Camera transport is pending — the current firmware does not expose a stream endpoint.
            See Camera page for details.
          </p>
        </div>
      </div>

      {/* Display settings */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Display</h2>
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Stale data threshold: <strong className="text-slate-300">{staleSecs}s</strong>
          </label>
          <input
            type="range"
            min={5}
            max={60}
            value={staleSecs}
            onChange={e => setStaleSecs(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>5s</span>
            <span>60s</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">Applied in this session only. Restart does not persist this.</p>
        </div>
      </div>

      {/* Hardware mode info */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Hardware Mode</h2>
        <p className="text-xs text-slate-400 mb-2">
          Configured in backend <code className="text-slate-300">.env</code> as <code className="text-slate-300">HARDWARE_MODE</code>.
        </p>
        <div className="bg-slate-800 rounded p-3 text-xs font-mono text-slate-300">
          <p># Simulation mode (no hardware needed)</p>
          <p>HARDWARE_MODE=simulation</p>
          <br />
          <p># Real hardware mode</p>
          <p>HARDWARE_MODE=real</p>
        </div>
        <p className="text-xs text-slate-500 mt-2 italic">
          In real mode, the simulator is disabled. The dashboard will show actual disconnected state when hardware is not sending data.
        </p>
      </div>
    </div>
  )
}
