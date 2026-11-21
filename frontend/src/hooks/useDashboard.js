/**
 * Central dashboard state hook.
 * Fetches initial data from REST and updates via WebSocket events.
 * Bounded chart history (last 60 readings per device).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getDashboard, getAlerts, getTelemetryHistory, getDevices } from '../services/api'
import { useWebSocket } from './useWebSocket'

const CHART_MAX_POINTS = 60
const STALE_THRESHOLD_MS = 15000

// WROOM freshness thresholds (ms) — mirrors wroom_state.py
const WROOM_LIVE_MS    = 1500
const WROOM_STALE_MS   = 5000

function isFresh(ts) {
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < STALE_THRESHOLD_MS
}

/** Derive freshness string from a JS timestamp (ms). */
function wroomFreshness(tsMs) {
  if (!tsMs) return 'offline'
  const age = Date.now() - tsMs
  if (age <= WROOM_LIVE_MS)  return 'live'
  if (age <= WROOM_STALE_MS) return 'stale'
  return 'offline'
}

export function useDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [devices, setDevices] = useState([])
  const [latestTelemetry, setLatestTelemetry] = useState({}) // keyed by deviceId
  const [chartData, setChartData] = useState([]) // flat list for charts
  const [alerts, setAlerts] = useState([])
  const [activeMission, setActiveMission] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  // WROOM live telemetry — separate from the SQLite-backed telemetry pipeline
  const [wroomData, setWroomData] = useState(null)      // latest packet fields
  const [wroomReceivedAt, setWroomReceivedAt] = useState(null)  // JS Date.now() ms
  const refreshRef = useRef(null)

  const fetchInitial = useCallback(async () => {
    try {
      setError(null)
      const [dash, alertsResp, histResp, devsResp] = await Promise.all([
        getDashboard(),
        getAlerts(),
        getTelemetryHistory({ limit: 60 }),
        getDevices(),
      ])

      const data = dash.data
      setDashboard(data)
      setActiveMission(data.activeMission)
      setDevices(devsResp.data || [])

      // Seed latest telemetry keyed by deviceId
      const latestMap = {}
      for (const t of data.latestTelemetry || []) {
        latestMap[t.deviceId] = t
      }
      setLatestTelemetry(latestMap)

      // Seed chart data from history (oldest first for charts)
      const history = (histResp.data || []).reverse()
      setChartData(history.slice(-CHART_MAX_POINTS))

      setAlerts(alertsResp.data || [])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitial()
    // Periodic refresh every 30s to catch any missed events
    refreshRef.current = setInterval(fetchInitial, 30000)
    return () => clearInterval(refreshRef.current)
  }, [fetchInitial])

  const handleWsEvent = useCallback((envelope) => {
    const { event, data } = envelope

    if (event === 'telemetry:update') {
      setLatestTelemetry(prev => ({ ...prev, [data.deviceId]: data }))
      setChartData(prev => {
        const next = [...prev, { ...data, time: data.receivedAt || new Date().toISOString() }]
        return next.slice(-CHART_MAX_POINTS)
      })
      setLastUpdated(new Date())
    }

    if (event === 'device:status') {
      setDevices(prev => {
        const existing = prev.find(d => d.deviceId === data.deviceId)
        if (existing) {
          return prev.map(d =>
            d.deviceId === data.deviceId ? { ...d, ...data } : d
          )
        }
        return [...prev, data]
      })
    }

    if (event === 'alert:created') {
      setAlerts(prev => [data, ...prev])
    }

    if (event === 'alert:updated') {
      setAlerts(prev =>
        prev.map(a => (a.id === data.id ? { ...a, ...data } : a))
      )
    }

    if (event === 'mission:updated') {
      setActiveMission(data.status === 'active' ? data : null)
    }

    if (event === 'wroom:update') {
      setWroomData(data)
      setWroomReceivedAt(Date.now())
    }
  }, [])

  const wsStatus = useWebSocket(handleWsEvent)

  const refresh = useCallback(() => {
    setLoading(true)
    fetchInitial()
  }, [fetchInitial])

  return {
    loading,
    error,
    dashboard,
    devices,
    latestTelemetry,
    chartData,
    alerts,
    activeMission,
    lastUpdated,
    wsStatus,
    refresh,
    isFresh,
    // WROOM UDP telemetry
    wroomData,
    wroomReceivedAt,
    wroomFreshness: () => wroomFreshness(wroomReceivedAt),
  }
}
