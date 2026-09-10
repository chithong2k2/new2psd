import { useState } from 'react'
import { Sparkles, Wand2, RefreshCw, Check, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { generateCaptions } from '../api'
import type { CaptionSuggestion, CaptionToneOption } from '../types'

interface CaptionAiGeneratorProps {
  projectId: string
  currentText: string
  onApply: (suggestion: CaptionSuggestion) => void
  disabled?: boolean
}

const DEFAULT_TONES: CaptionToneOption[] = [
  { id: 'viral',         label: 'Giật tít / Sốc',     icon: '💥', tagColor: '#ef4444', description: 'Kịch tính, kích thích tò mò' },
  { id: 'politics',      label: 'Thời sự / Xã hội',  icon: '🏛️', tagColor: '#2563eb', description: 'Nghiêm túc, chuẩn mực' },
  { id: 'entertainment', label: 'Giải trí / Showbiz', icon: '🎭', tagColor: '#f59e0b', description: 'Trẻ trung, bắt trend' },
  { id: 'curiosity',     label: 'Độc lạ / Khám phá', icon: '🔍', tagColor: '#10b981', description: 'Bất ngờ, kiến thức mới' },
  { id: 'finance',       label: 'Kinh tế / Tài chính',icon: '📈', tagColor: '#0ea5e9', description: 'Số liệu, biến động' },
  { id: 'sports',        label: 'Thể thao / Bóng đá', icon: '⚽', tagColor: '#8b5cf6', description: 'Năng động, kịch tính' },
]

export function CaptionAiGenerator({
  projectId,
  currentText,
  onApply,
  disabled = false,
}: CaptionAiGeneratorProps) {
  const [selectedTone, setSelectedTone] = useState<string>('viral')
  const [loading, setLoading] = useState<boolean>(false)
  const [suggestions, setSuggestions] = useState<CaptionSuggestion[]>([])
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (toneId?: string) => {
    const toneToUse = toneId || selectedTone
    setLoading(true)
    setError(null)
    setAppliedIndex(null)

    try {
      const res = await generateCaptions(projectId, toneToUse)
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions)
      } else {
        setError('Không tạo được gợi ý, vui lòng thử lại!')
      }
    } catch (err: unknown) {
      console.error(err)
      setError('Lỗi kết nối máy chủ khi tạo caption!')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTone = (toneId: string) => {
    setSelectedTone(toneId)
    handleGenerate(toneId)
  }

  const handleApply = (sug: CaptionSuggestion, index: number) => {
    setAppliedIndex(index)
    onApply(sug)
  }

  return (
    <div className="p-3.5 bg-gradient-to-b from-gray-900/90 to-gray-950 rounded-xl border border-gray-800 space-y-3 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-200">AI Tự Tạo Title Trong Ảnh</span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20">
              12 - 22 từ · Chuẩn khung
            </span>
          </div>
        </div>

        <button
          onClick={() => handleGenerate()}
          disabled={loading || disabled}
          className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Wand2 className="w-3 h-3" />
          )}
          <span>{suggestions.length > 0 ? 'Đổi gợi ý khác' : 'Tạo Title'}</span>
        </button>
      </div>

      {/* Tone selection pills */}
      <div className="space-y-1">
        <span className="text-[11px] text-gray-500 font-medium block">Chọn thể loại / phong cách:</span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {DEFAULT_TONES.map((tone) => {
            const isSelected = selectedTone === tone.id
            return (
              <button
                key={tone.id}
                onClick={() => handleSelectTone(tone.id)}
                disabled={loading || disabled}
                className={clsx(
                  'px-2 py-1.5 rounded-lg text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 border transition-all text-center',
                  isSelected
                    ? 'border-brand-500 bg-brand-500/15 text-brand-300 shadow-sm'
                    : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                )}
                title={tone.description}
              >
                <span className="text-xs">{tone.icon}</span>
                <span className="truncate w-full">{tone.label.split(' / ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-semibold text-gray-400 block">
            Gợi ý phù hợp (Bấm để áp dụng ngay):
          </span>

          <div className="space-y-1.5">
            {suggestions.map((sug, idx) => {
              const isApplied = appliedIndex === idx || currentText === sug.fullText
              return (
                <div
                  key={idx}
                  onClick={() => handleApply(sug, idx)}
                  className={clsx(
                    'p-2.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 group',
                    isApplied
                      ? 'bg-brand-500/10 border-brand-500 text-white ring-1 ring-brand-500/30'
                      : 'bg-gray-950/70 border-gray-800 hover:border-gray-700 hover:bg-gray-900 text-gray-300'
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white tracking-wider"
                        style={{ backgroundColor: sug.tagColor || '#ef4444' }}
                      >
                        {sug.tag}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">
                        {sug.wordCount} từ · Gói gọn khung
                      </span>
                    </div>

                    <p className="text-xs font-bold leading-snug line-clamp-2 text-gray-200 group-hover:text-white">
                      {sug.text}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApply(sug, idx)
                    }}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-all',
                      isApplied
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 group-hover:text-white'
                    )}
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3 h-3" /> Đang dùng
                      </>
                    ) : (
                      'Chọn'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
