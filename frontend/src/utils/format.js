/**
 * Display formatting utilities.
 * Never converts raw sensor values into physical units without calibration.
 */

/** Format a number with a fixed number of decimal places, returning '—' for null/undefined */
export function fmt(value, decimals = 1, unit = '') {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(decimals)}${unit ? ' ' + unit : ''}`
}

/** Format a boolean as a readable string */
export function fmtBool(value) {
  if (value === null || value === undefined) return '—'
  return value ? 'Yes' : 'No'
}

/** Format a UTC ISO timestamp as a locale time string */
export function fmtTime(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

/** Format a UTC ISO timestamp as a locale datetime string */
export function fmtDateTime(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '—'
  }
}

/** Returns a relative "X ago" string */
export function timeAgo(ts) {
  if (!ts) return '—'
  const delta = Date.now() - new Date(ts).getTime()
  if (delta < 0) return 'just now'
  if (delta < 60000) return `${Math.floor(delta / 1000)}s ago`
  if (delta < 3600000) return `${Math.floor(delta / 60000)}m ago`
  return `${Math.floor(delta / 3600000)}h ago`
}

/** Severity to Tailwind color class */
export function severityColor(severity) {
  switch (severity) {
    case 'critical': return 'text-red-400'
    case 'warning': return 'text-yellow-400'
    case 'info': return 'text-blue-400'
    default: return 'text-slate-400'
  }
}

export function severityBg(severity) {
  switch (severity) {
    case 'critical': return 'bg-red-500'
    case 'warning': return 'bg-yellow-500'
    case 'info': return 'bg-blue-500'
    default: return 'bg-slate-500'
  }
}

/** Device status to color class */
export function statusColor(status) {
  switch (status) {
    case 'online': return 'text-green-400'
    case 'stale': return 'text-yellow-400'
    case 'offline': return 'text-slate-500'
    default: return 'text-slate-500'
  }
}

export function statusDotColor(status) {
  switch (status) {
    case 'online': return 'bg-green-400'
    case 'stale': return 'bg-yellow-400'
    case 'offline': return 'bg-slate-500'
    case 'connected': return 'bg-green-400'
    case 'disconnected': return 'bg-red-400'
    case 'reconnecting': return 'bg-yellow-400'
    case 'error': return 'bg-red-400'
    default: return 'bg-slate-500'
  }
}
