import React, { useState } from 'react'
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react'
import { fmtDateTime, severityColor } from '../utils/format'
import { acknowledgeAlert } from '../services/api'

function SeverityIcon({ severity }) {
  if (severity === 'critical') return <AlertTriangle size={14} className="text-red-400 shrink-0" />
  if (severity === 'warning') return <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
  return <Info size={14} className="text-blue-400 shrink-0" />
}

function alertBorderClass(severity) {
  if (severity === 'critical') return 'border-red-700/60 bg-red-950/20'
  if (severity === 'warning') return 'border-yellow-700/60 bg-yellow-950/20'
  return 'border-blue-700/60 bg-blue-950/20'
}

export default function AlertList({ alerts, onAcknowledged }) {
  const [acking, setAcking] = useState(null)

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No active alerts</p>
      </div>
    )
  }

  const active = alerts.filter(a => a.status === 'active')
  const acknowledged = alerts.filter(a => a.status !== 'active')

  async function handleAck(alertId) {
    setAcking(alertId)
    try {
      await acknowledgeAlert(alertId, null)
      onAcknowledged?.(alertId)
    } catch {
      // fail silently for now; parent can refresh
    } finally {
      setAcking(null)
    }
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {active.map(alert => (
        <div
          key={alert.id}
          className={`border rounded-lg p-3 ${alertBorderClass(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <SeverityIcon severity={alert.severity} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${severityColor(alert.severity)}`}>
                  {alert.title}
                </p>
                {alert.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{alert.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                  {alert.deviceId && <span>Device: {alert.deviceId}</span>}
                  <span>{fmtDateTime(alert.createdAt)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleAck(alert.id)}
              disabled={acking === alert.id}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 px-2 py-1 rounded transition-colors disabled:opacity-50"
              title="Acknowledge alert"
            >
              {acking === alert.id ? '…' : 'Ack'}
            </button>
          </div>
        </div>
      ))}

      {acknowledged.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 select-none">
            {acknowledged.length} acknowledged alert{acknowledged.length !== 1 ? 's' : ''}
          </summary>
          <div className="space-y-1 mt-2">
            {acknowledged.map(alert => (
              <div
                key={alert.id}
                className="border border-slate-700/50 bg-slate-800/30 rounded-lg p-2 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400">{alert.title}</span>
                  {alert.acknowledgedBy && (
                    <span className="text-xs text-slate-600 ml-auto">by {alert.acknowledgedBy}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
