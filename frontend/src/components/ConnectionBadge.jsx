import React from 'react'
import { statusDotColor } from '../utils/format'

export default function ConnectionBadge({ status }) {
  const labels = {
    connected: 'Live',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting',
    error: 'Error',
  }
  const label = labels[status] || status || 'Unknown'

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`status-dot ${statusDotColor(status)} ${status === 'connected' ? 'animate-pulse' : ''}`} />
      <span className="text-slate-300">{label}</span>
    </div>
  )
}
