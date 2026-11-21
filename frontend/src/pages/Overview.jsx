import React from 'react'
import {
  Thermometer, Wind, Ruler, Radio, Battery, Activity,
  RefreshCw, Clock, AlertTriangle
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import SensorMetricCard from '../components/SensorMetricCard'
import AlertList from '../components/AlertList'
import DemoModeBanner from '../components/DemoModeBanner'
import LoadingSkeleton from '../components/LoadingSkeleton'
import ErrorState from '../components/ErrorState'
import { fmt, fmtBool, fmtTime, fmtDateTime, timeAgo, statusDotColor, statusColor } from '../utils/format'

const STALE_MS = 15000

function isStale(ts) {
  if (!ts) return true
  return Date.now() - new Date(ts).getTime() > STALE_MS
}

function MissionBanner({ mission }) {
  if (!mission) {
    return (
      <div className="card border-dashed border-slate-600 flex items-center gap-3 text-slate-500">
        <Activity size={16} />
        <span className="text-sm">No active mission. Create one on the Missions page.</span>
      </div>
    )
  }

  return (
    <div className="card border-green-700/50 bg-green-950/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="status-dot bg-green-400 animate-pulse" />
        <div>
          <span className="text-sm font-semibold text-green-300">ACTIVE MISSION</span>
          <span className="text-sm text-slate-300 ml-2">{mission.name}</span>
        </div>
      </div>
      {mission.startedAt && (
        <span className="text-xs text-slate-500">Started {timeAgo(mission.startedAt)}</span>
      )}
    </div>
  )
}

function DeviceCards({ devices }) {
  if (!devices || devices.length === 0) {
    return (
      <div className="card text-center py-6 text-slate-500 text-sm">
        No devices connected yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {devices.map(d => (
        <div key={d.deviceId || d.id} className="card flex items-center gap-3">
          <div className={`status-dot ${statusDotColor(d.status)}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{d.name || d.deviceId}</p>
            <p className={`text-xs ${statusColor(d.status)}`}>{d.status}</p>
            {d.lastSeenAt && (
              <p className="text-xs text-slate-600">{timeAgo(d.lastSeenAt)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SimpleSparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) return null
  const sliced = data.slice(-20).map(d => ({
    t: fmtTime(d.time || d.receivedAt),
    v: d[dataKey],
  })).filter(d => d.v !== null && d.v !== undefined)

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={sliced} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Overview({ loading, error, dashboard, devices, latestTelemetry, chartData, alerts, activeMission, lastUpdated, wsStatus, refresh, onAlertsChanged }) {
  if (loading) return <LoadingSkeleton rows={8} />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const isSimulation = dashboard?.hardwareMode === 'simulation'
  const primary = latestTelemetry && Object.values(latestTelemetry)[0]
  const receivedAt = primary?.receivedAt
  const stale = isStale(receivedAt)
  const srcMode = primary?.sourceMode

  const activeAlerts = alerts?.filter(a => a.status === 'active') || []

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={refresh}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Refresh dashboard"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {isSimulation && <DemoModeBanner />}

      {/* Mission + devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mission Status</h2>
          <MissionBanner mission={activeMission} />
        </div>
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected Devices</h2>
          <DeviceCards devices={devices} />
        </div>
      </div>

      {/* Sensor cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Live Sensor Readings</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <SensorMetricCard
            icon={<Thermometer size={16} className="text-orange-400" />}
            label="Temperature"
            value={fmt(primary?.temperatureC, 1)}
            unit="°C"
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color="text-orange-300"
          >
            <SimpleSparkline data={chartData} dataKey="temperatureC" color="#f97316" />
          </SensorMetricCard>

          <SensorMetricCard
            icon={<Wind size={16} className="text-purple-400" />}
            label="Gas/Smoke (MQ-2)"
            value={fmt(primary?.mq2Raw, 0)}
            unit="raw ADC"
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color="text-purple-300"
            note="Raw ADC reading — not calibrated ppm"
          >
            <SimpleSparkline data={chartData} dataKey="mq2Raw" color="#a855f7" />
          </SensorMetricCard>

          <SensorMetricCard
            icon={<Ruler size={16} className="text-cyan-400" />}
            label="Distance"
            value={fmt(primary?.distanceCm, 1)}
            unit="cm"
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color="text-cyan-300"
            note="Ultrasonic nearest distance"
          >
            <SimpleSparkline data={chartData} dataKey="distanceCm" color="#22d3ee" />
          </SensorMetricCard>

          <SensorMetricCard
            icon={<Radio size={16} className="text-green-400" />}
            label="PIR Motion"
            value={primary?.motionDetected === null || primary?.motionDetected === undefined ? '—' : primary.motionDetected ? 'Triggered' : 'Clear'}
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color={primary?.motionDetected ? 'text-yellow-300' : 'text-green-300'}
            note="PIR motion event (not human detection)"
          />

          <SensorMetricCard
            icon={<Battery size={16} className="text-blue-400" />}
            label="Battery"
            value={fmt(primary?.batteryPercent, 1)}
            unit="%"
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color={
              primary?.batteryPercent < 20 ? 'text-red-400' :
              primary?.batteryPercent < 40 ? 'text-yellow-400' : 'text-blue-300'
            }
          />

          <SensorMetricCard
            icon={<Activity size={16} className="text-teal-400" />}
            label="Signal (RSSI)"
            value={fmt(primary?.rssiDbm, 1)}
            unit="dBm"
            timestamp={receivedAt}
            sourceMode={srcMode}
            isStale={stale && !loading}
            color="text-teal-300"
          />
        </div>
      </div>

      {/* Chart section */}
      {chartData && chartData.length > 2 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Temperature History (°C)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData.slice(-40)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
              <XAxis
                dataKey="receivedAt"
                tickFormatter={v => fmtTime(v)}
                tick={{ fill: '#64748b', fontSize: 10 }}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8 }}
                labelFormatter={v => fmtTime(v)}
                formatter={(v) => [fmt(v, 1, '°C'), 'Temp']}
              />
              <Line type="monotone" dataKey="temperatureC" stroke="#f97316" dot={false} strokeWidth={2} name="Temp (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <AlertTriangle size={14} className={activeAlerts.length > 0 ? 'text-yellow-400' : 'text-slate-500'} />
            Active Alerts
            {activeAlerts.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {activeAlerts.length}
              </span>
            )}
          </h2>
        </div>
        <AlertList alerts={alerts} onAcknowledged={onAlertsChanged} />
      </div>
    </div>
  )
}
