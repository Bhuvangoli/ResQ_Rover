import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Play, Square, Download, RefreshCw, ChevronRight } from 'lucide-react'
import { getMissions, createMission, startMission, stopMission, getTelemetryHistory, exportMission } from '../services/api'
import { fmtDateTime, timeAgo } from '../utils/format'

function StatusBadge({ status }) {
  const c = {
    planned: 'bg-slate-700 text-slate-300',
    active: 'bg-green-900/60 text-green-300 border border-green-700/50',
    completed: 'bg-blue-900/60 text-blue-300',
    aborted: 'bg-red-900/60 text-red-300',
  }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${c[status] || 'bg-slate-700 text-slate-400'}`}>
      {status}
    </span>
  )
}

function CreateMissionForm({ onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [building, setBuilding] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Mission name is required'); return }
    setLoading(true)
    setError('')
    try {
      const r = await createMission({ name: name.trim(), description: description || null, buildingId: building || null })
      onCreated(r.data)
      setName(''); setDescription(''); setBuilding('')
    } catch (err) {
      setError(err.message || 'Failed to create mission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">New Mission</h3>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Mission name <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Building 4 - Floor 2 Search"
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          required
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Building / Area ID</label>
        <input
          type="text"
          value={building}
          onChange={e => setBuilding(e.target.value)}
          placeholder="Optional building identifier"
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm flex items-center gap-2">
        <Plus size={14} />
        {loading ? 'Creating…' : 'Create Mission'}
      </button>
    </form>
  )
}

function MissionDetail({ mission, onUpdate }) {
  const [telemetry, setTelemetry] = useState([])
  const [loadingAction, setLoadingAction] = useState(null)

  useEffect(() => {
    if (mission?.id) {
      getTelemetryHistory({ missionId: mission.id, limit: 20 })
        .then(r => setTelemetry(r.data || []))
        .catch(() => {})
    }
  }, [mission?.id])

  async function handleStart() {
    setLoadingAction('start')
    try {
      const r = await startMission(mission.id)
      onUpdate(r.data)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleStop() {
    if (!confirm('Stop this mission?')) return
    setLoadingAction('stop')
    try {
      const r = await stopMission(mission.id)
      onUpdate(r.data)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{mission.name}</h3>
          {mission.description && <p className="text-xs text-slate-400 mt-0.5">{mission.description}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={mission.status} />
            <span className="text-xs text-slate-500">{fmtDateTime(mission.createdAt)}</span>
          </div>
          {mission.startedAt && <p className="text-xs text-slate-500">Started: {fmtDateTime(mission.startedAt)}</p>}
          {mission.endedAt && <p className="text-xs text-slate-500">Ended: {fmtDateTime(mission.endedAt)}</p>}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          {mission.status === 'planned' && (
            <button onClick={handleStart} disabled={loadingAction} className="btn-primary text-xs flex items-center gap-1.5">
              <Play size={12} />
              {loadingAction === 'start' ? 'Starting…' : 'Start'}
            </button>
          )}
          {mission.status === 'active' && (
            <button onClick={handleStop} disabled={loadingAction} className="btn-danger text-xs flex items-center gap-1.5">
              <Square size={12} />
              {loadingAction === 'stop' ? 'Stopping…' : 'Stop'}
            </button>
          )}
          <a
            href={exportMission(mission.id, 'csv')}
            download
            className="btn-secondary text-xs flex items-center gap-1.5 text-center justify-center"
          >
            <Download size={12} />
            CSV
          </a>
          <a
            href={exportMission(mission.id, 'json')}
            download
            className="btn-secondary text-xs flex items-center gap-1.5 text-center justify-center"
          >
            <Download size={12} />
            JSON
          </a>
        </div>
      </div>

      {/* Recent telemetry */}
      {telemetry.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">Recent Telemetry ({telemetry.length} records)</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {telemetry.map(t => (
              <div key={t.id} className="flex items-center gap-3 text-xs text-slate-400 py-1 border-b border-slate-800">
                <span className="text-slate-500 w-20 shrink-0">{timeAgo(t.receivedAt)}</span>
                <span>T: {t.temperatureC != null ? `${t.temperatureC}°C` : '—'}</span>
                <span>MQ2: {t.mq2Raw ?? '—'}</span>
                <span>Dist: {t.distanceCm != null ? `${t.distanceCm}cm` : '—'}</span>
                {t.sourceMode === 'simulated' && <span className="sim-badge">SIM</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MissionsPage() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchMissions = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getMissions()
      setMissions(r.data || [])
    } catch {
      setMissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMissions() }, [fetchMissions])

  function handleCreated(mission) {
    setMissions(prev => [mission, ...prev])
    setSelected(mission)
    setShowCreate(false)
  }

  function handleUpdated(updated) {
    setMissions(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelected(updated)
  }

  const activeMission = missions.find(m => m.status === 'active')

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Missions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeMission ? `Active: ${activeMission.name}` : 'No active mission'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchMissions} className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={14} />
            New Mission
          </button>
        </div>
      </div>

      {/* Important note about data persistence */}
      <div className="card border-yellow-700/40 bg-yellow-950/10 py-2.5">
        <p className="text-xs text-yellow-300">
          <strong>⚠ Prototype Data Notice:</strong> Mission data is stored in an in-memory database.
          All missions and telemetry are lost when the backend restarts. This is by design for the prototype.
        </p>
      </div>

      {showCreate && <CreateMissionForm onCreated={handleCreated} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mission list */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            All Missions ({missions.length})
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="card h-14 animate-pulse" />)}
            </div>
          ) : missions.length === 0 ? (
            <div className="card text-center py-8 text-slate-600">
              <p className="text-sm">No missions yet</p>
              <p className="text-xs mt-1">Create your first mission above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {missions.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full text-left card hover:border-orange-700/50 transition-colors flex items-center justify-between gap-2
                    ${selected?.id === m.id ? 'border-orange-600/60' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={m.status} />
                      <span className="text-xs text-slate-600">{timeAgo(m.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mission detail */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Detail</h2>
          {selected ? (
            <MissionDetail mission={selected} onUpdate={handleUpdated} />
          ) : (
            <div className="card text-center py-8 text-slate-600 text-sm">
              Select a mission to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
