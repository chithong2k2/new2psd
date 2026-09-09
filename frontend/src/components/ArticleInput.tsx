import { useState } from 'react'
import { Search, CheckCircle, Circle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface ArticleInputProps {
  onAnalyze: (url: string) => Promise<void>
  analyzing: boolean
  done: boolean
}

const STEPS = [
  'Reading article',
  'Finding images',
  'Extracting captions',
  'Preparing content',
]

export function ArticleInput({ onAnalyze, analyzing, done }: ArticleInputProps) {
  const [url, setUrl] = useState('')
  const [currentStep, setCurrentStep] = useState(-1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Animate steps
    setCurrentStep(0)
    const stepInterval = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= STEPS.length - 1) { clearInterval(stepInterval); return s }
        return s + 1
      })
    }, 600)

    try {
      await onAnalyze(url.trim())
    } finally {
      clearInterval(stepInterval)
      setCurrentStep(-1)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://vnexpress.net/article-slug..."
          className="input-field flex-1"
          disabled={analyzing}
        />
        <button
          type="submit"
          disabled={analyzing || !url.trim()}
          className="btn-primary flex-shrink-0"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {analyzing ? 'Analyzing' : 'Analyze'}
        </button>
      </form>

      {analyzing && (
        <div className="space-y-2 animate-fade-in">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep
            const isDone = i < currentStep || (done && i <= currentStep)
            return (
              <div key={step} className={clsx(
                'flex items-center gap-3 text-sm transition-all duration-300',
                isDone ? 'text-green-400' : isActive ? 'text-brand-400' : 'text-gray-600'
              )}>
                {isDone ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 flex-shrink-0" />
                )}
                {step}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
