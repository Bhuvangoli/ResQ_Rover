import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Camera, Map,
  Bell, ClipboardList, Settings, Menu, X,
  Wifi, WifiOff
} from 'lucide-react'
import ConnectionBadge from '../components/ConnectionBadge'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/monitoring', label: 'Live Sensors', icon: Activity },
  { to: '/camera', label: 'Camera', icon: Camera },
  { to: '/map', label: 'Building Map', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/missions', label: 'Missions', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppShell({ children, wsStatus }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-full bg-[#0f1117]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-[#1a1d27] border-r border-[#2a2d3a] transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3a]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">RR</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">ResQ Rover</p>
              <p className="text-xs text-slate-500 leading-tight">Operations</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-orange-600/20 text-orange-400 border border-orange-700/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
              end={to === '/'}
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* WebSocket status at bottom */}
        <div className="px-4 py-3 border-t border-[#2a2d3a]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {wsStatus === 'connected'
              ? <Wifi size={12} className="text-green-400" />
              : <WifiOff size={12} className="text-red-400" />
            }
            <ConnectionBadge status={wsStatus} />
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3a] bg-[#1a1d27] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-orange-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-black">R</span>
            </div>
            <span className="text-sm font-semibold text-white">ResQ Rover</span>
          </div>
          <ConnectionBadge status={wsStatus} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
