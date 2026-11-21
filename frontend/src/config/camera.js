/**
 * Central camera configuration.
 *
 * The live stream is served by the FastAPI backend at /api/camera/stream,
 * which the Vite dev-server proxy forwards to http://127.0.0.1:8000.
 * The React dashboard never connects to the ESP32-CAM directly.
 *
 * To change the UDP port the backend listens on, edit CAMERA_UDP_PORT in
 * backend/.env — no frontend change is needed.
 *
 * VITE_CAMERA_IP is kept here only for the informational subtitle shown in
 * the Camera page header; it is not used to build any request URL.
 */

/** Informational only — shown in the Camera page subtitle. */
export const CAMERA_IP = import.meta.env.VITE_CAMERA_IP || ''

/**
 * The MJPEG stream URL consumed by MjpegStream.
 * Relative path so it works through the Vite proxy in dev
 * and against the same origin in production.
 */
export const CAMERA_STREAM_URL = '/api/camera/stream'

/**
 * Returns a cache-busted version of the stream URL.
 * Used by MjpegStream to force a fresh TCP connection on reconnect.
 */
export function buildStreamUrl(base = CAMERA_STREAM_URL) {
  if (!base) return ''
  return `${base}?t=${Date.now()}`
}
