import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Plus, Trash2, Info, MapPin, AlertTriangle, Eye } from 'lucide-react'
import { uploadBlueprint, getBlueprints, getObservations, createObservation, getMissions } from '../services/api'
import { fmtDateTime } from '../utils/format'

const MARKER_TYPES = [
  { id: 'gas_smoke', label: 'Gas/Smoke', color: '#a855f7' },
  { id: 'high_temperature', label: 'High Temperature', color: '#f97316' },
  { id: 'motion_event', label: 'Motion Event', color: '#eab308' },
  { id: 'obstacle', label: 'Obstacle', color: '#64748b' },
  { id: 'snapshot', label: 'Snapshot', color: '#22d3ee' },
  { id: 'rover_waypoint', label: 'Rover Waypoint', color: '#22c55e' },
  { id: 'operator_note', label: 'Operator Note', color: '#3b82f6' },
]

function MarkerDot({ type, x, y, label, onClick }) {
  const mt = MARKER_TYPES.find(m => m.id === type) || MARKER_TYPES[0]
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <circle cx={x} cy={y} r={9} fill={mt.color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
        {label ? label[0].toUpperCase() : '?'}
      </text>
    </g>
  )
}

export default function BuildingMap() {
  const [blueprints, setBlueprints] = useState([])
  const [selectedBlueprint, setSelectedBlueprint] = useState(null)
  const [observations, setObservations] = useState([])
  const [missions, setMissions] = useState([])
  const [selectedMission, setSelectedMission] = useState(null)
  const [markerMode, setMarkerMode] = useState(false)
  const [pendingMarker, setPendingMarker] = useState(null)
  const [markerForm, setMarkerForm] = useState({ type: 'operator_note', label: '', description: '', severity: '' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [imageSize, setImageSize] = useState({ w: 800, h: 600 })
  const [filterType, setFilterType] = useState('')
  const imgRef = useRef(null)
  const svgRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getBlueprints().then(r => setBlueprints(r.data || [])).catch(() => {})
    getMissions().then(r => setMissions(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedMission) {
      getObservations(selectedMission).then(r => setObservations(r.data || [])).catch(() => {})
    }
  }, [selectedMission])

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setUploadError('Only PNG and JPEG images are supported.')
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('name', file.name.replace(/\.[^.]+$/, ''))
      fd.append('file', file)
      const r = await uploadBlueprint(fd)
      const newBp = r.data
      setBlueprints(prev => [newBp, ...prev])
      setSelectedBlueprint(newBp)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleMapClick(e) {
    if (!markerMode || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPendingMarker({ x, y })
  }

  async function saveMarker() {
    if (!pendingMarker || !selectedMission) return
    try {
      const payload = {
        missionId: selectedMission,
        blueprintId: selectedBlueprint?.id || null,
        type: markerForm.type,
        label: markerForm.label || markerForm.type,
        description: markerForm.description || null,
        severity: markerForm.severity || null,
        xNormalized: pendingMarker.x,
        yNormalized: pendingMarker.y,
        locationMethod: 'manual',
      }
      const r = await createObservation(payload)
      setObservations(prev => [r.data, ...prev])
      setPendingMarker(null)
      setMarkerMode(false)
    } catch (err) {
      alert('Failed to save marker: ' + (err.message || err))
    }
  }

  const displayObs = filterType
    ? observations.filter(o => o.type === filterType)
    : observations

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-white">Building Map</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload a floor plan and place manual observation markers</p>
      </div>

      {/* Important disclaimer */}
      <div className="card border-yellow-700/40 bg-yellow-950/10 flex items-start gap-3">
        <Info size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-300">
          <strong>Manual/Estimated Location:</strong> Marker positions are placed manually by the operator.
          No automatic localization system is connected. Marker locations are estimates only.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mission selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Mission:</label>
          <select
            value={selectedMission || ''}
            onChange={e => setSelectedMission(e.target.value || null)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="">Select mission…</option>
            {missions.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Blueprint selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Blueprint:</label>
          <select
            value={selectedBlueprint?.id || ''}
            onChange={e => setSelectedBlueprint(blueprints.find(b => b.id === e.target.value) || null)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          >
            <option value="">No floor plan</option>
            {blueprints.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload Floor Plan'}
          </button>
          {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
        </div>

        {/* Add marker */}
        {selectedMission && (
          <button
            onClick={() => setMarkerMode(!markerMode)}
            className={`text-sm flex items-center gap-2 ${markerMode ? 'btn-danger' : 'btn-primary'}`}
          >
            {markerMode ? '✕ Cancel' : (<><Plus size={14} /> Add Marker</>)}
          </button>
        )}
      </div>

      {markerMode && (
        <div className="card border-orange-700/50 bg-orange-950/10 text-sm text-orange-300">
          Click anywhere on the map below to place a marker. Locations are <strong>manual/estimated</strong>.
        </div>
      )}

      {/* Map viewer */}
      <div className="card relative overflow-hidden min-h-64">
        {selectedBlueprint ? (
          <div className="relative">
            <div className="text-xs text-slate-500 mb-2 italic">
              Floor plan: {selectedBlueprint.name} — Manual marker placement only
            </div>
            <div className="relative select-none">
              <img
                ref={imgRef}
                src={`/api/storage/blueprints/${selectedBlueprint.storageKey?.split('/').pop()}`}
                alt={selectedBlueprint.name}
                className="w-full max-h-[500px] object-contain rounded bg-slate-900"
                onLoad={e => setImageSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                onError={() => {}}
              />
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                onClick={handleMapClick}
                style={{ cursor: markerMode ? 'crosshair' : 'default' }}
              >
                {displayObs.map(obs => obs.xNormalized != null && (
                  <MarkerDot
                    key={obs.id}
                    type={obs.type}
                    x={obs.xNormalized}
                    y={obs.yNormalized}
                    label={obs.label}
                  />
                ))}
                {pendingMarker && (
                  <circle cx={pendingMarker.x} cy={pendingMarker.y} r={0.012} fill="#ff6b2b" stroke="white" strokeWidth={0.004} />
                )}
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
            <MapPin size={40} className="opacity-20" />
            <p className="text-sm">No floor plan selected</p>
            <p className="text-xs">Upload a PNG or JPEG floor plan to get started</p>
          </div>
        )}
      </div>

      {/* Pending marker form */}
      {pendingMarker && (
        <div className="card border-orange-700/50">
          <h3 className="text-sm font-semibold text-orange-300 mb-3">Place Marker</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Type</label>
              <select
                value={markerForm.type}
                onChange={e => setMarkerForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              >
                {MARKER_TYPES.map(mt => <option key={mt.id} value={mt.id}>{mt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Severity</label>
              <select
                value={markerForm.severity}
                onChange={e => setMarkerForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="">None</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">Label</label>
            <input
              type="text"
              value={markerForm.label}
              onChange={e => setMarkerForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Smoke smell near stairwell"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">Description (optional)</label>
            <textarea
              value={markerForm.description}
              onChange={e => setMarkerForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="text-xs text-slate-500 italic mb-3">
            Position: ({(pendingMarker.x * 100).toFixed(1)}%, {(pendingMarker.y * 100).toFixed(1)}%) — Manual/estimated location
          </div>
          <div className="flex gap-2">
            <button onClick={saveMarker} className="btn-primary text-sm" disabled={!selectedMission}>Save Marker</button>
            <button onClick={() => { setPendingMarker(null); setMarkerMode(false) }} className="btn-secondary text-sm">Cancel</button>
          </div>
          {!selectedMission && <p className="text-xs text-red-400 mt-2">Select a mission first to save markers</p>}
        </div>
      )}

      {/* Marker legend */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Legend</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MARKER_TYPES.map(mt => (
            <div key={mt.id} className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: mt.color }} />
              {mt.label}
            </div>
          ))}
        </div>
      </div>

      {/* Observations list */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Observations ({displayObs.length})</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Filter:</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="">All types</option>
              {MARKER_TYPES.map(mt => <option key={mt.id} value={mt.id}>{mt.label}</option>)}
            </select>
          </div>
        </div>

        {displayObs.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">No observations yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {displayObs.map(obs => {
              const mt = MARKER_TYPES.find(m => m.id === obs.type)
              return (
                <div key={obs.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                  <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: mt?.color || '#888' }} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-300 font-medium truncate">{obs.label}</p>
                    {obs.description && <p className="text-xs text-slate-500 truncate">{obs.description}</p>}
                    <div className="flex gap-2 text-xs text-slate-600 mt-0.5">
                      <span className="italic">{obs.locationMethod}</span>
                      <span>{fmtDateTime(obs.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
