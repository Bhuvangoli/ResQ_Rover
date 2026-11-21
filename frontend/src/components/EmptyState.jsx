import React from 'react'
import { InboxIcon } from 'lucide-react'

export default function EmptyState({ title = 'No data', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
      <InboxIcon size={36} className="opacity-30" />
      <div className="text-center">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {description && <p className="text-xs mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
