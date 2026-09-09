import { AlertCircle, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-fade-in">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-300 flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-500 hover:text-red-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
