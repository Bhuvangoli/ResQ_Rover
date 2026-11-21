import React, { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './layouts/AppShell'
import { useDashboard } from './hooks/useDashboard'
import { getAlerts } from './services/api'

// Pages
import Overview from './pages/Overview'
import LiveMonitoring from './pages/LiveMonitoring'
import CameraPage from './pages/Camera'
import BuildingMap from './pages/BuildingMap'
import AlertsPage from './pages/Alerts'
import MissionsPage from './pages/Missions'
import Settings from './pages/Settings'

export default function App() {
  const dashboard = useDashboard()

  // Refresh alerts after acknowledgement
  const handleAlertsChanged = useCallback(async () => {
    try {
      const r = await getAlerts()
      // The dashboard hook doesn't expose setAlerts directly,
      // so we trigger a full refresh
      dashboard.refresh()
    } catch {}
  }, [dashboard.refresh])

  return (
    <AppShell wsStatus={dashboard.wsStatus}>
      <Routes>
        <Route
          path="/"
          element={
            <Overview
              {...dashboard}
              onAlertsChanged={handleAlertsChanged}
            />
          }
        />
        <Route
          path="/monitoring"
          element={
            <LiveMonitoring
              latestTelemetry={dashboard.latestTelemetry}
              chartData={dashboard.chartData}
              wsStatus={dashboard.wsStatus}
              isSimulation={dashboard.dashboard?.hardwareMode === 'simulation'}
              wroomData={dashboard.wroomData}
              wroomReceivedAt={dashboard.wroomReceivedAt}
              wroomFreshness={dashboard.wroomFreshness}
            />
          }
        />
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/map" element={<BuildingMap />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/missions" element={<MissionsPage />} />
        <Route
          path="/settings"
          element={<Settings wsStatus={dashboard.wsStatus} />}
        />
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-64 text-slate-500">
              <div className="text-center">
                <p className="text-4xl font-bold mb-2">404</p>
                <p>Page not found</p>
              </div>
            </div>
          }
        />
      </Routes>
    </AppShell>
  )
}
