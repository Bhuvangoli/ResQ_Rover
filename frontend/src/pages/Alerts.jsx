import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, RefreshCw, Info } from 'lucide-react'
import { getAlerts, acknowledgeAlert } from '../services/api'
import { fmtDateTime, severityColor, severityBg, timeAgo } from '../utils/format'

function SeverityPill({ severity }) {
  const colors = {
    critical: 'bg-red-900/60 text-red-300 border-red-700/50',
    warning: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50',
    info: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
  }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${colors[severity] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {severity || 'unknown'}
    </span>
  )
}

function StatusPill({ status }) {
  if (status === 'active') return <span className="text-xs text-red-400 font-semibold">ACTIVE</span>
  if (status === 'acknowledged') return <span className="text-xs text-green-400">Acknowledged</span>
  if (status === 'resolved') return <span className="text-xs text-slate-500">Resolved</span>
  return <span className="text-xs text-slate-500">{status}</span>
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [acking, setAcking] = useState(null)
  const [operatorName, setOperatorName] = useState('')

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getAlerts(statusFilter === 'all' ? undefined : statusFilter)
      setAlerts(r.data || [])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  async function handleAck(alertId) {
    setAcking(alertId)
    try {
      await acknowledgeAlert(alertId, operatorName || null)
      setAlerts(prev => prev.map(a => a.id === alertId
        ? { ...a, status: 'acknowledged', acknowledgedBy: operatorName || null }
        : a
      ))
    } catch (err) {
      alert('Failed to acknowledge: ' + err.message)
    } finally {
      setAcking(null)
    }
  }

  const activeCount = alerts.filter(a => a.status === 'active').length
  const criticalCount = alerts.filter(a => a.status === 'active' && a.severity === 'critical').length

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount > 0
              ? `${activeCount} active alert${activeCount !== 1 ? 's' : ''}${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}`
              : 'No active alerts'}
          </p>
        </div>
        <button onClick={fetchAlerts} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Disclaimer */}
      <div className="card border-blue-700/40 bg-blue-950/10 flex items-start gap-2 py-2.5">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300">
          Alert severity is defined by backend threshold rules. MQ-2 readings are raw ADC values — not calibrated ppm.
          No alert constitutes a certified safety assessment.
        </p>
      </div>

      {/* Filters and operator name */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {['all', 'active', 'acknowledged', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors capitalize
                ${statusFilter === f ? 'bg-orange-600 border-orange-500 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-slate-400">Your name (for ack):</label>
          <input
            type="text"
            value={operatorName}
            onChange={e => setOperatorName(e.target.value)}
            placeholder="Operator"
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 w-28 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-slate-600">
          <CheckCircle size={36} className="opacity-30 mb-2" />
          <p>No alerts in this filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const triggerVal = (() => {
              try { return JSON.parse(alert.triggerValueJson || '{}') } catch { return {} }
            })()
            const threshold = (() => {
              try { return JSON.parse(alert.thresholdJson || '{}') } catch { return {} }
            })()

            return (
              <div
                key={alert.id}
                className={`card border flex flex-col sm:flex-row sm:items-start gap-3
                  ${alert.severity === 'critical' ? 'border-red-700/60 bg-red-950/10' :
                    alert.severity === 'warning' ? 'border-yellow-700/60 bg-yellow-950/10' :
                    'border-blue-700/60 bg-blue-950/10'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SeverityPill severity={alert.severity} />
                    <span className="text-sm font-semibold text-slate-200">{alert.title}</span>
                    <StatusPill status={alert.status} />
                  </div>
                  {alert.description && (
                    <p className="text-xs text-slate-400 mb-1">{alert.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    {alert.deviceId && <span>Device: {alert.deviceId}</span>}
                    {triggerVal.field && <span>Field: {triggerVal.field} = {triggerVal.value}</span>}
                    {threshold.operator && <span>Threshold: {threshold.operator} {threshold.threshold}</span>}
                    <span>Created: {timeAgo(alert.createdAt)}</span>
                    {alert.acknowledgedBy && <span>Acked by: {alert.acknowledgedBy}</span>}
                  </div>
                </div>
                {alert.status === 'active' && (
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={acking === alert.id}
                    className="btn-secondary text-xs shrink-0"
                  >
                    {acking === alert.id ? 'Acknowledging…' : 'Acknowledge'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
