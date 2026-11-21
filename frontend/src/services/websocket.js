/**
 * WebSocket client for ResQ Rover backend real-time events.
 * Uses native browser WebSocket API (no Socket.IO).
 * Handles reconnection with exponential backoff.
 */

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.host}`
const WS_PATH = '/api/ws'

export class RoverWebSocket {
  constructor(onEvent, onStatus) {
    this._onEvent = onEvent
    this._onStatus = onStatus
    this._ws = null
    this._reconnectDelay = 1000
    this._maxDelay = 30000
    this._stopped = false
    this._pingInterval = null
  }

  connect() {
    if (this._stopped) return
    const url = `${WS_BASE}${WS_PATH}`
    this._onStatus('connecting')

    try {
      this._ws = new WebSocket(url)
    } catch (err) {
      this._scheduleReconnect()
      return
    }

    this._ws.onopen = () => {
      this._reconnectDelay = 1000
      this._onStatus('connected')
      // Start ping heartbeat
      this._pingInterval = setInterval(() => {
        if (this._ws?.readyState === WebSocket.OPEN) {
          this._ws.send('ping')
        }
      }, 25000)
    }

    this._ws.onmessage = (evt) => {
      try {
        const envelope = JSON.parse(evt.data)
        if (envelope.event === 'pong') return
        this._onEvent(envelope)
      } catch {
        // Ignore malformed messages
      }
    }

    this._ws.onclose = () => {
      this._clearPing()
      if (!this._stopped) {
        this._onStatus('disconnected')
        this._scheduleReconnect()
      }
    }

    this._ws.onerror = () => {
      this._clearPing()
      this._onStatus('error')
    }
  }

  _clearPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
  }

  _scheduleReconnect() {
    if (this._stopped) return
    this._onStatus('reconnecting')
    setTimeout(() => this.connect(), this._reconnectDelay)
    this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, this._maxDelay)
  }

  disconnect() {
    this._stopped = true
    this._clearPing()
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }
}
