/**
 * React hook for the ResQ Rover WebSocket connection.
 * Manages connection lifecycle, reconnection and event dispatch.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { RoverWebSocket } from '../services/websocket'

export function useWebSocket(onEvent) {
  const [wsStatus, setWsStatus] = useState('disconnected')
  const wsRef = useRef(null)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const ws = new RoverWebSocket(
      (envelope) => onEventRef.current?.(envelope),
      (status) => setWsStatus(status),
    )
    wsRef.current = ws
    ws.connect()

    return () => ws.disconnect()
  }, [])

  return wsStatus
}
