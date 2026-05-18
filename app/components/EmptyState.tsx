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
      <div className="relative mx-auto mb-6 w-20 h-20" aria-hidden="true">
        <div className="absolute inset-0 rounded-2xl bg-orange-100 opacity-40 scale-110" />
        <div className="absolute inset-0 rounded-2xl bg-orange-50 opacity-70 scale-105" />
        <div className="relative w-full h-full rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-400">
          {icon}
        </div>
      </div>
      <h2 className="text-base font-semibold text-neutral-900 mb-2">{title}</h2>
      <p className="text-sm text-neutral-400 mb-6 max-w-xs mx-auto leading-relaxed">{description}</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {action && action.label && (
          <button
            type="button"
            onClick={action.onClick}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && secondaryAction.label && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-sm font-semibold rounded-xl transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
      {tip && (
        <p className="mt-6 text-xs text-neutral-300 flex items-center justify-center gap-1.5 border-t border-neutral-100 pt-5">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {tip}
        </p>
      )}
    </div>
  )
}
