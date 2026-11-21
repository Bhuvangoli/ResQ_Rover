/**
 * Centralized REST API client for ResQ Rover backend.
 * All requests go through this module — no direct fetch calls in components.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request(method, path, body = null, options = {}) {
  const url = `${BASE_URL}${path}`
  const config = {
    method,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  }
  if (body && !(body instanceof FormData)) {
    config.body = JSON.stringify(body)
  } else if (body instanceof FormData) {
    delete config.headers['Content-Type']
    config.body = body
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    let errData
    try { errData = await response.json() } catch { errData = {} }
    const msg = errData?.error?.message || `HTTP ${response.status}`
    throw new ApiError(msg, response.status, errData)
  }

  return response.json()
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// Health
export const getHealth = () => request('GET', '/api/health')

// Dashboard
export const getDashboard = () => request('GET', '/api/dashboard')

// Devices
export const getDevices = () => request('GET', '/api/devices')

// Telemetry
export const getTelemetryLatest = (deviceId) =>
  request('GET', `/api/telemetry/latest${deviceId ? `?deviceId=${deviceId}` : ''}`)

export const getTelemetryHistory = (params = {}) => {
  const q = new URLSearchParams()
  if (params.deviceId) q.set('deviceId', params.deviceId)
  if (params.missionId) q.set('missionId', params.missionId)
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.limit) q.set('limit', params.limit)
  return request('GET', `/api/telemetry/history?${q}`)
}

export const postTelemetry = (payload) => request('POST', '/api/telemetry', payload)

// Alerts
export const getAlerts = (status) =>
  request('GET', `/api/alerts${status ? `?status=${status}` : ''}`)

export const acknowledgeAlert = (alertId, operatorName) =>
  request('POST', `/api/alerts/${alertId}/acknowledge`, { operatorName })

// Missions
export const getMissions = () => request('GET', '/api/missions')
export const createMission = (payload) => request('POST', '/api/missions', payload)
export const getMission = (id) => request('GET', `/api/missions/${id}`)
export const startMission = (id) => request('POST', `/api/missions/${id}/start`)
export const stopMission = (id) => request('POST', `/api/missions/${id}/stop`)
export const exportMission = (id, format = 'json') =>
  `${BASE_URL}/api/missions/${id}/export?format=${format}`

// Blueprints
export const getBlueprints = () => request('GET', '/api/blueprints')
export const uploadBlueprint = (formData) => request('POST', '/api/blueprints', formData)

// Observations
export const getObservations = (missionId) =>
  request('GET', `/api/observations${missionId ? `?missionId=${missionId}` : ''}`)

export const createObservation = (payload) => request('POST', '/api/observations', payload)
