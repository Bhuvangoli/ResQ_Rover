import React from 'react'
import { timeAgo } from '../utils/format'

function StaleLabel() {
  return (
    <span className="text-xs text-yellow-400 font-medium border border-yellow-700/50 bg-yellow-950/40 px-1.5 py-0.5 rounded ml-1">
      STALE
    </span>
  )
}

function SimLabel() {
  return (
    <span className="sim-badge ml-1">
      SIM
    </span>
  )
}

export default function SensorMetricCard({
  icon,
  label,
  value,
  unit,
  timestamp,
  sourceMode,
  isStale,
  note,
  color = 'text-white',
  children,
}) {
  return (
    <div className={`card flex flex-col gap-2 ${isStale ? 'border-yellow-700/50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="metric-label">{label}</span>
        </div>
        <div className="flex items-center">
          {isStale && <StaleLabel />}
          {sourceMode === 'simulated' && <SimLabel />}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`metric-value ${isStale ? 'opacity-60' : ''} ${color}`}>
          {value ?? '—'}
        </span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>

      {note && <p className="text-xs text-slate-500 italic">{note}</p>}

      {children}

      {timestamp && (
        <p className="text-xs text-slate-600 mt-auto">{timeAgo(timestamp)}</p>
      )}
    </div>
  )
}
