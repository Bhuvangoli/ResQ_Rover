import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import { getTelemetryHistory } from '../services/api'
import { fmt, fmtTime, fmtDateTime, timeAgo } from '../utils/format'
import DemoModeBanner from '../components/DemoModeBanner'
import LoadingSkeleton from '../components/LoadingSkeleton'

const STALE_MS = 15000
const DEFAULT_DEVICE = 'rover-01'

function StaleWarning() {
  return (
    <div className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 border border-yellow-700/50 bg-yellow-950/30 px-2 py-0.5 rounded-full">
      ⚠ Stale — no recent data
    </div>
  )
}

function SimBadge() {
  return (
    <span className="sim-badge">SIM DATA</span>
  )
}

export default function LiveMonitoring({ latestTelemetry, chartData, wsStatus, isSimulation, wroomData, wroomReceivedAt, wroomFreshness }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE)
  const [range, setRange] = useState(60)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getTelemetryHistory({ deviceId, limit: range })
      setHistory((r.data || []).reverse())
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [deviceId, range])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Merge live chart data with fetched history
  const displayData = chartData && chartData.length > 0
    ? chartData.filter(d => deviceId === DEFAULT_DEVICE || d.deviceId === deviceId)
    : history

  const primary = latestTelemetry && Object.values(latestTelemetry).find(t => t.deviceId === deviceId)
    || (latestTelemetry && Object.values(latestTelemetry)[0])

  const receivedAt = primary?.receivedAt
  const stale = !receivedAt || Date.now() - new Date(receivedAt).getTime() > STALE_MS
  const simMode = primary?.sourceMode === 'simulated'

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Live Sensor Monitoring</h1>
          <p className="text-sm text-slate-500">Raw sensor readings from rover-01</p>
        </div>
        <div className="flex items-center gap-2">
          {simMode && <SimBadge />}
          {stale && <StaleWarning />}
        </div>
      </div>

      {isSimulation && <DemoModeBanner />}

      {/* ── WROOM UDP telemetry ─────────────────────────────────────── */}
      {(() => {
        const freshness  = wroomFreshness ? wroomFreshness() : 'offline'
        const hasData    = !!wroomData
        const lastSeenMs = wroomReceivedAt

        const freshnessConfig = {
          live:    { dot: 'bg-green-400 animate-pulse', text: 'text-green-300',  label: 'LIVE'    },
          stale:   { dot: 'bg-yellow-400',              text: 'text-yellow-300', label: 'STALE'   },
          offline: { dot: 'bg-red-500',                 text: 'text-red-400',    label: 'OFFLINE' },
        }
        const fc = freshnessConfig[freshness] || freshnessConfig.offline

        return (
          <div className="space-y-3">
            {/* Status bar */}
            <div className="card py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${fc.dot}`} />
                <span className="text-xs font-semibold text-slate-400">WROOM</span>
                <span className={`text-xs font-bold ${fc.text}`}>{fc.label}</span>
              </div>
              {hasData && wroomData.device && (
                <span className="text-xs text-slate-500 font-mono">{wroomData.device}</span>
              )}
              {lastSeenMs && (
                <span className="text-xs text-slate-600">
                  last packet {timeAgo(new Date(lastSeenMs).toISOString())}
                </span>
              )}
              {hasData && (
                <>
                  <span className="text-xs text-slate-500">
                    Wi-Fi:{' '}
                    <span className={wroomData.wifiConnected ? 'text-green-400' : 'text-red-400'}>
                      {wroomData.wifiConnected ? 'connected' : 'disconnected'}
                    </span>
                  </span>
                  {wroomData.rssiDbm != null && (
                    <span className="text-xs text-slate-500">
                      RSSI: <span className="text-slate-300">{wroomData.rssiDbm} dBm</span>
                    </span>
                  )}
                </>
              )}
              {!hasData && (
                <span className="text-xs text-slate-600 italic">
                  Waiting for UDP packets on port 4211…
                </span>
              )}
            </div>

            {/* WROOM sensor cards */}
            {hasData && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* Distance */}
                <div className={`card border-cyan-700/40 flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">Distance</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="metric-value text-cyan-300">
                      {wroomData.distanceCm != null ? fmt(wroomData.distanceCm, 1) : '—'}
                    </span>
                    <span className="metric-unit">cm</span>
                  </div>
                  <p className="text-xs text-slate-500 italic">Ultrasonic nearest distance</p>
                </div>

                {/* MQ-2 Raw */}
                <div className={`card border-purple-700/40 flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">Gas / Smoke (MQ-2)</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="metric-value text-purple-300">
                      {wroomData.gasRaw != null ? fmt(wroomData.gasRaw, 0) : '—'}
                    </span>
                    <span className="metric-unit">raw ADC</span>
                  </div>
                  <p className="text-xs text-slate-500 italic">Not calibrated ppm — relative indicator</p>
                </div>

                {/* MQ-2 Voltage */}
                <div className={`card border-purple-700/30 flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">Gas Voltage</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="metric-value text-purple-200">
                      {wroomData.gasVoltage != null ? fmt(wroomData.gasVoltage, 3) : '—'}
                    </span>
                    <span className="metric-unit">V</span>
                  </div>
                  <p className="text-xs text-slate-500 italic">MQ-2 analog output voltage</p>
                </div>

                {/* PIR */}
                <div className={`card flex flex-col gap-1 ${wroomData.pirMotion ? 'border-yellow-700/50' : 'border-green-700/40'} ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">PIR Motion</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`metric-value ${wroomData.pirMotion ? 'text-yellow-300' : 'text-green-300'}`}>
                      {wroomData.pirMotion == null ? '—' : wroomData.pirMotion ? 'Triggered' : 'Clear'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 italic">PIR event — not human detection</p>
                </div>

                {/* Motor state */}
                <div className={`card flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">Motors</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`metric-value ${wroomData.motorsRunning ? 'text-orange-300' : 'text-slate-400'}`}>
                      {wroomData.motorsRunning == null ? '—' : wroomData.motorsRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                </div>

                {/* Mode */}
                <div className={`card flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                  <p className="metric-label">Drive Mode</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`metric-value ${wroomData.mode === 'AUTO' ? 'text-blue-300' : 'text-red-400'}`}>
                      {wroomData.mode ?? '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 italic">AUTO / STOP</p>
                </div>

                {/* Packet counter */}
                {wroomData.sensorReadings != null && (
                  <div className={`card border-slate-700/40 flex flex-col gap-1 ${freshness !== 'live' ? 'opacity-60' : ''}`}>
                    <p className="metric-label">Sensor Readings</p>
                    <span className="metric-value text-slate-300">{wroomData.sensorReadings}</span>
                    <p className="text-xs text-slate-500 italic">Rolling firmware counter</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Existing simulator / REST telemetry ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            id: 'temp', label: 'Temperature', value: fmt(primary?.temperatureC, 2), unit: '°C',
            note: 'Ambient temperature from onboard sensor',
            color: 'text-orange-300', border: 'border-orange-700/40'
          },
          {
            id: 'mq2', label: 'MQ-2 Gas/Smoke', value: fmt(primary?.mq2Raw, 0), unit: 'raw ADC',
            note: 'Raw ADC reading — NOT calibrated ppm. Relative indicator only.',
            color: 'text-purple-300', border: 'border-purple-700/40'
          },
          {
            id: 'dist', label: 'Distance', value: fmt(primary?.distanceCm, 1), unit: 'cm',
            note: 'Ultrasonic sensor — nearest measured distance',
            color: 'text-cyan-300', border: 'border-cyan-700/40'
          },
          {
            id: 'pir', label: 'PIR Motion',
            value: primary?.motionDetected === null || primary?.motionDetected === undefined
              ? '—' : primary.motionDetected ? 'Triggered' : 'Clear',
            note: 'PIR motion event — not human detection',
            color: primary?.motionDetected ? 'text-yellow-300' : 'text-green-300',
            border: primary?.motionDetected ? 'border-yellow-700/40' : 'border-green-700/40'
          },
          {
            id: 'batt', label: 'Battery',
            value: fmt(primary?.batteryPercent, 1), unit: '%',
            note: primary?.batteryVoltage ? `${fmt(primary.batteryVoltage, 2)} V` : null,
            color: primary?.batteryPercent < 20 ? 'text-red-400' : 'text-blue-300',
            border: 'border-blue-700/40'
          },
          {
            id: 'rssi', label: 'RSSI',
            value: fmt(primary?.rssiDbm, 1), unit: 'dBm',
            note: 'Signal strength indicator',
            color: 'text-teal-300', border: 'border-teal-700/40'
          },
        ].map(item => (
          <div key={item.id} className={`card ${item.border} flex flex-col gap-2`}>
            <p className="metric-label">{item.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className={`metric-value ${item.color} ${stale ? 'opacity-50' : ''}`}>
                {item.value}
              </span>
              {item.unit && <span className="metric-unit">{item.unit}</span>}
            </div>
            {item.note && <p className="text-xs text-slate-500 italic">{item.note}</p>}
            {receivedAt && <p className="text-xs text-slate-600 mt-auto">{timeAgo(receivedAt)}</p>}
          </div>
        ))}
      </div>

      {/* Chart controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">Chart points:</span>
        {[30, 60, 100, 200].map(n => (
          <button
            key={n}
            onClick={() => setRange(n)}
            className={`text-xs px-3 py-1 rounded border transition-colors
              ${range === n ? 'bg-orange-600 border-orange-500 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'}`}
          >
            {n}
          </button>
        ))}
        <button onClick={fetchHistory} className="btn-secondary text-xs ml-auto">Refresh</button>
      </div>

      {/* Temperature chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Temperature (°C)</h2>
        {loading ? (
          <div className="h-40 animate-pulse bg-slate-800 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={displayData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="receivedAt" tickFormatter={v => fmtTime(v)} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
                labelFormatter={v => fmtDateTime(v)}
                formatter={(v) => [fmt(v, 2, '°C'), 'Temperature']}
              />
              <Area type="monotone" dataKey="temperatureC" stroke="#f97316" fill="url(#tempGrad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gas chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-1">MQ-2 Gas/Smoke Sensor — Raw ADC</h2>
        <p className="text-xs text-slate-500 mb-3 italic">
          Raw analog-to-digital converter reading. Not calibrated to ppm. Higher values indicate more gas/smoke relative to baseline.
        </p>
        {loading ? (
          <div className="h-40 animate-pulse bg-slate-800 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={displayData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="mq2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="receivedAt" tickFormatter={v => fmtTime(v)} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
                labelFormatter={v => fmtDateTime(v)}
                formatter={(v) => [v !== null && v !== undefined ? `${v} (raw ADC)` : '—', 'MQ-2']}
              />
              <Area type="monotone" dataKey="mq2Raw" stroke="#a855f7" fill="url(#mq2Grad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Distance chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Distance (cm) — Ultrasonic Sensor</h2>
        {loading ? (
          <div className="h-40 animate-pulse bg-slate-800 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={displayData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis dataKey="receivedAt" tickFormatter={v => fmtTime(v)} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
                labelFormatter={v => fmtDateTime(v)}
                formatter={(v) => [fmt(v, 1, 'cm'), 'Distance']}
              />
              <Line type="monotone" dataKey="distanceCm" stroke="#22d3ee" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
