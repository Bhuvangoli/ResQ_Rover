import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center justify-center py-10 gap-4">
      <AlertCircle size={40} className="text-red-400 opacity-70" />
      <div className="text-center">
        <p className="text-slate-300 font-medium">Failed to load data</p>
        <p className="text-sm text-slate-500 mt-1">{message || 'An error occurred'}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}
