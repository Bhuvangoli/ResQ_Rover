import React from 'react'

export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-1/3 mb-3" />
      <div className="h-8 bg-slate-700 rounded w-1/2 mb-2" />
      <div className="h-3 bg-slate-700 rounded w-1/4" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 py-3 border-b border-slate-800">
      <div className="h-3 bg-slate-700 rounded w-1/4" />
      <div className="h-3 bg-slate-700 rounded w-1/4" />
      <div className="h-3 bg-slate-700 rounded w-1/4" />
      <div className="h-3 bg-slate-700 rounded w-1/4" />
    </div>
  )
}

export default function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: rows }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
