import { useEffect, useState } from 'react'

interface CaptionEditorProps {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  disabled?: boolean
}

export function CaptionEditor({ value, onChange, maxLength = 300, disabled }: CaptionEditorProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => { setLocalValue(value) }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setLocalValue(v)
    onChange(v)
  }

  const pct = Math.min(100, Math.round((localValue.length / maxLength) * 100))
  const isNear = localValue.length > maxLength * 0.85
  const isOver = localValue.length > maxLength

  return (
    <div className="space-y-2">
      <textarea
        value={localValue}
        onChange={handleChange}
        disabled={disabled}
        rows={4}
        placeholder="Enter caption for the image…"
        className="input-field resize-none leading-relaxed"
        maxLength={maxLength + 50}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">Caption will use PSD's original font &amp; style</span>
        <span className={isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-gray-600'}>
          {localValue.length} / {maxLength}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOver ? 'bg-red-500' : isNear ? 'bg-yellow-500' : 'bg-brand-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
