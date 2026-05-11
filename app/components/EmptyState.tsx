'use client'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  tip?: string
}

export default function EmptyState({ icon, title, description, action, secondaryAction, tip }: EmptyStateProps) {
  return (
    <div role="region" aria-label={title} className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
      <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400" aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-neutral-800 mb-1">{title}</h2>
      <p className="text-xs text-neutral-400 mb-5 max-w-xs mx-auto leading-relaxed">{description}</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {action && action.label && (
          <button
            type="button"
            onClick={action.onClick}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && secondaryAction.label && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-semibold rounded-xl transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
      {tip && (
        <p className="mt-5 text-[11px] text-neutral-300 flex items-center justify-center gap-1">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {tip}
        </p>
      )}
    </div>
  )
}
