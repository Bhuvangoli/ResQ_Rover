/**
 * MjpegStream — robust ESP32-CAM MJPEG stream component.
 *
 * Reconnection strategy
 * ─────────────────────
 * • One <img> element stays mounted for the lifetime of the component.
 *   Its `src` is replaced (with a ?t= cache-buster) to open a new TCP
 *   connection; the element itself is never unmounted/remounted, which
 *   would briefly create two parallel connections.
 *
 * • onLoad  → status LIVE, reset backoff counter, arm the periodic-
 *             refresh timer.
 *
 * • onError → status RECONNECTING, schedule a retry after the current
 *             backoff delay (1 s → 2 → 4 → 8 → 10 s cap).
 *             After MAX_FAILURES consecutive errors, move to OFFLINE
 *             and stop retrying (user can click Resume).
 *
 * • Periodic refresh: every REFRESH_INTERVAL_MS (4 min) while LIVE,
 *   replace the src to recycle the long-lived TCP connection proactively.
 *
 * • Page visibility: all timers are paused while the tab is hidden.
 *   On becoming visible again the stream is reconnected immediately
 *   (src replaced, status → CONNECTING).
 *
 * • Cleanup: every timer/listener is stored in a ref and cleared in the
 *   useEffect cleanup, handling React Strict Mode double-invocation and
 *   navigation away from the page.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { VideoOff, RefreshCw, Wifi, WifiOff, Loader } from 'lucide-react'
import { buildStreamUrl, CAMERA_STREAM_URL } from '../config/camera'

// ── Tunables ────────────────────────────────────────────────────────────────
const BACKOFF_BASE_MS     = 1_000   // initial retry delay
const BACKOFF_MAX_MS      = 10_000  // maximum retry delay
const BACKOFF_MULTIPLIER  = 2       // exponent base
const MAX_FAILURES        = 5       // consecutive errors before OFFLINE
const REFRESH_INTERVAL_MS = 4 * 60 * 1000  // proactive TCP recycle (4 min)
// ────────────────────────────────────────────────────────────────────────────

export const STREAM_STATUS = {
  CONNECTING:   'CONNECTING',
  LIVE:         'LIVE',
  RECONNECTING: 'RECONNECTING',
  OFFLINE:      'OFFLINE',
}

function StatusPill({ status, lastConnected }) {
  const cfg = {
    [STREAM_STATUS.CONNECTING]:   { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-300', label: 'Connecting' },
    [STREAM_STATUS.LIVE]:         { dot: 'bg-green-400 animate-pulse',  text: 'text-green-300',  label: 'Live' },
    [STREAM_STATUS.RECONNECTING]: { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-300', label: 'Reconnecting' },
    [STREAM_STATUS.OFFLINE]:      { dot: 'bg-red-500',                  text: 'text-red-400',    label: 'Offline' },
  }
  const { dot, text, label } = cfg[status] || cfg[STREAM_STATUS.OFFLINE]

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span className={`font-semibold ${text}`}>{label}</span>
      {lastConnected && status !== STREAM_STATUS.LIVE && (
        <span className="text-slate-500">
          · last live {lastConnected.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}

function Overlay({ status, onResume }) {
  if (status === STREAM_STATUS.LIVE) return null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 rounded-lg">
      {status === STREAM_STATUS.OFFLINE ? (
        <>
          <WifiOff size={36} className="text-red-400 opacity-70" />
          <p className="text-sm text-slate-300 font-medium">Camera offline</p>
          <p className="text-xs text-slate-500">Could not reach the stream after several attempts.</p>
          <button
            onClick={onResume}
            className="mt-1 btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Resume
          </button>
        </>
      ) : (
        <>
          <Loader size={28} className="text-yellow-400 animate-spin" />
          <p className="text-sm text-slate-300">
            {status === STREAM_STATUS.CONNECTING ? 'Connecting to camera…' : 'Reconnecting…'}
          </p>
        </>
      )}
    </div>
  )
}

export default function MjpegStream({ streamUrl = CAMERA_STREAM_URL, className = '' }) {
  const [status, setStatus]           = useState(STREAM_STATUS.CONNECTING)
  const [lastConnected, setLastConnected] = useState(null)

  // All mutable state that must not trigger re-renders lives in refs.
  const imgRef          = useRef(null)
  const retryTimerRef   = useRef(null)
  const refreshTimerRef = useRef(null)
  const failureCount    = useRef(0)
  const backoffMs       = useRef(BACKOFF_BASE_MS)
  const isMounted       = useRef(false)
  const currentSrc      = useRef('')

  // ── Core: replace src to open a fresh connection ─────────────────────────
  const connect = useCallback(() => {
    if (!isMounted.current || !imgRef.current) return
    const url = buildStreamUrl(streamUrl)
    if (!url) return
    // Guard: do not re-assign the same URL that is already loading; this
    // can happen if visibilitychange fires while a retry is already pending.
    if (currentSrc.current === url) return
    currentSrc.current = url
    imgRef.current.src = url
    setStatus(STREAM_STATUS.CONNECTING)
  }, [streamUrl])

  // ── Arm the periodic refresh timer (called each time stream goes LIVE) ───
  const armRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      if (!isMounted.current) return
      // Only recycle if still live and tab is visible
      if (document.visibilityState === 'visible') {
        currentSrc.current = '' // allow connect() to proceed
        connect()
      }
    }, REFRESH_INTERVAL_MS)
  }, [connect])

  // ── Clear all pending timers ──────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (retryTimerRef.current)   { clearTimeout(retryTimerRef.current);   retryTimerRef.current   = null }
    if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null }
  }, [])

  // ── img event handlers ────────────────────────────────────────────────────
  const handleLoad = useCallback(() => {
    if (!isMounted.current) return
    failureCount.current = 0
    backoffMs.current    = BACKOFF_BASE_MS
    setStatus(STREAM_STATUS.LIVE)
    setLastConnected(new Date())
    armRefreshTimer()
  }, [armRefreshTimer])

  const handleError = useCallback(() => {
    if (!isMounted.current) return
    failureCount.current += 1
    clearAllTimers()

    if (failureCount.current >= MAX_FAILURES) {
      setStatus(STREAM_STATUS.OFFLINE)
      return
    }

    setStatus(STREAM_STATUS.RECONNECTING)
    const delay = backoffMs.current
    backoffMs.current = Math.min(backoffMs.current * BACKOFF_MULTIPLIER, BACKOFF_MAX_MS)

    retryTimerRef.current = setTimeout(() => {
      currentSrc.current = '' // allow connect() to treat this as a new URL
      connect()
    }, delay)
  }, [clearAllTimers, connect])

  // ── Manual resume after OFFLINE ───────────────────────────────────────────
  const handleResume = useCallback(() => {
    failureCount.current = 0
    backoffMs.current    = BACKOFF_BASE_MS
    currentSrc.current   = ''
    connect()
  }, [connect])

  // ── Page visibility ───────────────────────────────────────────────────────
  useEffect(() => {
    function onVisibilityChange() {
      if (!isMounted.current) return
      if (document.visibilityState === 'visible') {
        // Tab came back into focus — reconnect immediately unless already live
        clearAllTimers()
        if (status !== STREAM_STATUS.LIVE) {
          failureCount.current = 0
          backoffMs.current    = BACKOFF_BASE_MS
        }
        currentSrc.current = ''
        connect()
      } else {
        // Tab hidden — pause everything to avoid pointless background retries
        clearAllTimers()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [status, connect, clearAllTimers])

  // ── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl) return   // nothing to do without a configured URL
    isMounted.current = true
    connect()

    return () => {
      isMounted.current = false
      clearAllTimers()
      // Blank the src so the browser closes the TCP connection immediately.
      if (imgRef.current) {
        imgRef.current.src = ''
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl])  // re-run only if the base URL itself changes

  // ── No URL configured ─────────────────────────────────────────────────────
  if (!streamUrl) {
    return (
      <div className={`relative bg-black rounded-lg overflow-hidden aspect-video flex flex-col items-center justify-center gap-3 text-slate-600 ${className}`}>
        <VideoOff size={40} className="opacity-30" />
        <p className="text-sm">Camera IP not configured</p>
        <p className="text-xs text-center px-6">
          Set <code className="text-slate-500">VITE_CAMERA_IP</code> in <code className="text-slate-500">frontend/.env</code>
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Video container — fixed 16:9 aspect ratio, black letterbox */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {/* The single <img> element that carries the MJPEG stream */}
        <img
          ref={imgRef}
          alt="ESP32-CAM live stream"
          className="w-full h-full object-contain"
          onLoad={handleLoad}
          onError={handleError}
          // src is set imperatively via imgRef — never via React state —
          // so that React never creates a second element while reconciling.
        />
        <Overlay status={status} onResume={handleResume} />
      </div>

      {/* Status bar below the video */}
      <div className="flex items-center justify-between px-1">
        <StatusPill status={status} lastConnected={lastConnected} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 font-mono truncate max-w-48" title={streamUrl}>
            {streamUrl}
          </span>
          {status !== STREAM_STATUS.CONNECTING && (
            <button
              onClick={handleResume}
              className="text-slate-500 hover:text-slate-200 transition-colors"
              title="Force reconnect"
              aria-label="Force reconnect"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
