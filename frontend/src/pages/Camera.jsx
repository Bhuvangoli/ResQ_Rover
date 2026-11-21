import React, { useState, useEffect } from 'react'
import { Camera, Info, Activity } from 'lucide-react'
import MjpegStream from '../components/MjpegStream'
import { CAMERA_STREAM_URL, CAMERA_IP } from '../config/camera'

export default function CameraPage() {
  const [cameraStatus, setCameraStatus] = useState(null)

  useEffect(() => {
    fetch('/api/camera/status')
      .then(r => r.json())
      .then(d => setCameraStatus(d.data))
      .catch(() => setCameraStatus(null))

    const interval = setInterval(() => {
      fetch('/api/camera/status')
        .then(r => r.json())
        .then(d => setCameraStatus(d.data))
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const receiverRunning = cameraStatus?.receiver?.running ?? false
  const totalFrames     = cameraStatus?.frames?.total_frames ?? 0
  const frameAge        = cameraStatus?.frames?.last_frame_age_seconds

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Camera</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          ESP32-CAM live stream via UDP → FastAPI MJPEG
          {CAMERA_IP && (
            <span className="ml-2 font-mono text-slate-600">
              {CAMERA_IP}:4210 → /api/camera/stream
            </span>
          )}
        </p>
      </div>

      {/* Receiver stats bar */}
      {cameraStatus && (
        <div className="card py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${receiverRunning ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-slate-400">UDP receiver</span>
            <span className={receiverRunning ? 'text-green-300 font-medium' : 'text-red-400 font-medium'}>
              {receiverRunning ? 'running' : 'stopped'}
            </span>
          </div>
          <div className="text-slate-500">
            port <span className="text-slate-300">{cameraStatus.receiver?.port ?? 4210}</span>
          </div>
          <div className="text-slate-500">
            packets <span className="text-slate-300">{cameraStatus.receiver?.packets_received ?? 0}</span>
          </div>
          <div className="text-slate-500">
            frames <span className="text-slate-300">{totalFrames}</span>
          </div>
          {frameAge !== null && frameAge !== undefined && (
            <div className="text-slate-500">
              last frame <span className="text-slate-300">{frameAge.toFixed(1)}s ago</span>
            </div>
          )}
          {cameraStatus.receiver?.invalid_packets > 0 && (
            <div className="text-yellow-500">
              invalid pkts <span className="font-medium">{cameraStatus.receiver.invalid_packets}</span>
            </div>
          )}
          {cameraStatus.receiver?.frames_discarded > 0 && (
            <div className="text-yellow-500">
              discarded <span className="font-medium">{cameraStatus.receiver.frames_discarded}</span>
            </div>
          )}
        </div>
      )}

      {/* Live stream */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Camera size={14} />
          Live Feed
        </h2>
        <MjpegStream streamUrl={CAMERA_STREAM_URL} />
      </div>

      {/* Technical notes */}
      <div className="card border-slate-700/50">
        <div className="flex items-start gap-3">
          <Info size={15} className="text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-500">
            <p>
              Stream endpoint:{' '}
              <code className="text-slate-400">{CAMERA_STREAM_URL}</code>
              {' '}(proxied through FastAPI)
            </p>
            <p>
              The browser connects to FastAPI, not to the camera directly.
              FastAPI reassembles UDP packets from the ESP32-CAM and serves MJPEG.
            </p>
            <p>
              To adjust the UDP port, set{' '}
              <code className="text-slate-400">CAMERA_UDP_PORT</code> in{' '}
              <code className="text-slate-400">backend/.env</code>.
              To disable the receiver, set{' '}
              <code className="text-slate-400">CAMERA_UDP_ENABLED=False</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Snapshot gallery placeholder */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Snapshots</h2>
        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
          <Camera size={32} className="opacity-30 mb-2" />
          <p className="text-sm">No snapshots received yet</p>
          <p className="text-xs mt-1">
            Snapshots will be stored once the camera sends JPEG frames.
          </p>
        </div>
      </div>
    </div>
  )
}
