import { useState, useRef } from 'react'
import clsx from 'clsx'
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Palette,
  Tag,
  RotateCcw,
  Sparkles,
  Maximize2,
} from 'lucide-react'
import type { CaptionStyle, CaptionSegment } from '../types'
import { AVAILABLE_FONTS } from '../types'

interface AdvancedCaptionEditorProps {
  value: CaptionStyle
  onChange: (v: CaptionStyle) => void
  disabled?: boolean
}

const PRESET_COLORS = [
  { name: 'Đỏ Hot', hex: '#ef4444' },
  { name: 'Vàng tươi', hex: '#facc15' },
  { name: 'Xanh dương', hex: '#38bdf8' },
  { name: 'Xanh lá', hex: '#22c55e' },
  { name: 'Cam', hex: '#fb923c' },
  { name: 'Tím', hex: '#c084fc' },
  { name: 'Trắng', hex: '#ffffff' },
  { name: 'Đen', hex: '#0f172a' },
]

export function AdvancedCaptionEditor({ value, onChange, disabled }: AdvancedCaptionEditorProps) {
  const [showFontMenu, setShowFontMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selRange, setSelRange] = useState<{ start: number; end: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')

  const maxLen = 500
  const pct = Math.min(100, Math.round((value.text.length / maxLen) * 100))

  const update = (patch: Partial<CaptionStyle>) => onChange({ ...value, ...patch })

  // Track selection inside textarea
  const handleSelectText = () => {
    const el = textareaRef.current
    if (!el) return
    if (el.selectionStart !== el.selectionEnd) {
      setSelRange({ start: el.selectionStart, end: el.selectionEnd })
      setSelectedText(value.text.slice(el.selectionStart, el.selectionEnd))
    } else {
      setSelRange(null)
      setSelectedText('')
    }
  }

  // Apply color: either to selected range OR entire text
  const handleApplyColor = (colorHex: string) => {
    if (selRange && selRange.end > selRange.start && value.text) {
      // Selective coloring for the highlighted text span
      const newSegments = applyColorToSelection(
        value.text,
        selRange.start,
        selRange.end,
        colorHex,
        value.segments,
        value.color || '#ffffff'
      )
      update({ segments: newSegments })
    } else {
      // Uniform color for the entire text
      update({
        color: colorHex,
        segments: value.segments
          ? value.segments.map((s) => ({ ...s, color: colorHex }))
          : undefined,
      })
    }
  }

  // 1-Click: Highlight Prefix Tag (e.g. "CHUYỆN KHÓ TIN:")
  const handleHighlightPrefixTag = () => {
    if (!value.text) return
    const colonIdx = value.text.indexOf(':')
    let tag = ''
    let rest = ''

    if (colonIdx > 0 && colonIdx < 40) {
      tag = value.text.slice(0, colonIdx + 1)
      rest = value.text.slice(colonIdx + 1)
    } else {
      const words = value.text.trim().split(/\s+/)
      if (words.length >= 2) {
        tag = words.slice(0, 2).join(' ')
        rest = value.text.slice(tag.length)
      } else {
        tag = value.text
        rest = ''
      }
    }

    const segments: CaptionSegment[] = [
      { text: tag, color: '#ef4444' }, // Red tag
      ...(rest ? [{ text: rest, color: value.color || '#ffffff' }] : []),
    ]
    update({ segments })
  }

  // Reset to single uniform color
  const handleResetToSingleColor = () => {
    update({ segments: undefined })
  }

  // Update a specific segment's color from the pill list
  const handleUpdateSegmentColor = (idx: number, newColor: string) => {
    if (!value.segments) return
    const next = [...value.segments]
    next[idx] = { ...next[idx], color: newColor }
    update({ segments: next })
  }

  // Handle text typing
  const handleTextChange = (newText: string) => {
    // If segments existed, keep them aligned if possible or update
    if (value.segments && value.segments.length === 2 && newText.startsWith(value.segments[0].text)) {
      const rest = newText.slice(value.segments[0].text.length)
      update({
        text: newText,
        segments: [
          value.segments[0],
          { text: rest, color: value.segments[1].color || value.color || '#ffffff' },
        ],
      })
    } else {
      update({ text: newText, segments: undefined })
    }
    setSelRange(null)
    setSelectedText('')
  }

  return (
    <div className="space-y-3">
      {/* Text area */}
      <div className="space-y-1">
        <textarea
          ref={textareaRef}
          value={value.text}
          onChange={(e) => handleTextChange(e.target.value)}
          onSelect={handleSelectText}
          onMouseUp={handleSelectText}
          onKeyUp={handleSelectText}
          disabled={disabled}
          rows={3}
          placeholder="Nhập nội dung caption..."
          className="input-field resize-none leading-relaxed text-sm w-full font-medium"
          maxLength={maxLen + 50}
        />
        {/* Char count bar */}
        <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all',
              value.text.length > maxLen
                ? 'bg-red-500'
                : value.text.length > maxLen * 0.85
                ? 'bg-yellow-500'
                : 'bg-brand-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── SELECTIVE COLORING TOOLBAR (Canva / Photoshop style) ── */}
      <div className="p-2.5 bg-gray-900/90 rounded-xl border border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-semibold text-gray-300">Đổi màu chữ:</span>
            {selectedText ? (
              <span className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded font-medium truncate max-w-[170px]">
                Đoạn: "{selectedText}"
              </span>
            ) : (
              <span className="text-[10px] text-gray-500">
                (Bôi đen chữ để đổi màu riêng biệt)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleHighlightPrefixTag}
              className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 flex items-center gap-1 transition-all"
              title="Tự động tô màu đỏ cho Tag mở đầu (ví dụ: CHUYỆN KHÓ TIN:)"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>Tô đỏ Tag</span>
            </button>
            {value.segments && value.segments.length > 0 && (
              <button
                type="button"
                onClick={handleResetToSingleColor}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 flex items-center gap-0.5 transition-all"
                title="Đặt lại toàn bộ chữ về cùng 1 màu đồng nhất"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>1 màu</span>
              </button>
            )}
          </div>
        </div>

        {/* Color swatches palette */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => handleApplyColor(c.hex)}
              className="w-6 h-6 rounded-md border border-gray-700 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center relative shadow-sm"
              style={{ backgroundColor: c.hex }}
              title={`Tô màu ${c.name} (${c.hex})`}
            />
          ))}

          {/* Custom color input */}
          <div className="relative flex items-center" title="Chọn màu tùy biến">
            <input
              type="color"
              value={value.color || '#ffffff'}
              onChange={(e) => handleApplyColor(e.target.value)}
              className="w-6 h-6 rounded-md border border-gray-700 bg-transparent cursor-pointer p-0 hover:scale-110 transition-transform"
            />
          </div>
        </div>

        {/* Multi-colored segment chips */}
        {value.segments && value.segments.length > 1 && (
          <div className="pt-2 border-t border-gray-800 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500 font-medium">Các đoạn màu:</span>
            {value.segments.map((seg, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800/80 border border-gray-700 text-[11px]"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/40 shrink-0"
                  style={{ backgroundColor: seg.color || value.color }}
                />
                <span className="truncate max-w-[90px] font-medium text-gray-200">
                  {seg.text.trim() || 'khoảng cách'}
                </span>
                <input
                  type="color"
                  value={seg.color || value.color}
                  onChange={(e) => handleUpdateSegmentColor(idx, e.target.value)}
                  className="w-3.5 h-3.5 rounded cursor-pointer bg-transparent border-none p-0 opacity-80 hover:opacity-100"
                  title="Đổi màu đoạn này"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Typography row 1: Font + Size */}
      <div className="flex gap-2">
        {/* Font picker */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowFontMenu(!showFontMenu)}
            className="w-full input-field py-2 flex items-center justify-between text-sm"
          >
            <span style={{ fontFamily: value.fontFamily }}>{value.fontFamily}</span>
            <ChevronDown
              className={clsx(
                'w-3.5 h-3.5 text-gray-500 transition-transform',
                showFontMenu && 'rotate-180'
              )}
            />
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-20 shadow-xl">
              {AVAILABLE_FONTS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    update({ fontFamily: f })
                    setShowFontMenu(false)
                  }}
                  className={clsx(
                    'w-full px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors',
                    value.fontFamily === f ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300'
                  )}
                  style={{ fontFamily: f }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font size */}
        <div className="w-24 flex items-center gap-1">
          <input
            type="number"
            min={8}
            max={400}
            step={1}
            value={Math.round(value.fontSize)}
            onChange={(e) =>
              update({ fontSize: Math.max(8, Math.min(400, Number(e.target.value))) })
            }
            className="input-field py-2 text-sm text-center w-full"
            title="Cỡ chữ (px)"
          />
        </div>
      </div>

      {/* Typography row 2: Bold, Italic, Align, Background */}
      <div className="flex items-center gap-2">
        {/* Bold */}
        <button
          onClick={() => update({ bold: !value.bold })}
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
            value.bold
              ? 'border-brand-500 bg-brand-500/20 text-brand-400'
              : 'border-gray-700 text-gray-500 hover:border-gray-600'
          )}
          title="In đậm"
        >
          <Bold className="w-4 h-4" />
        </button>

        {/* Italic */}
        <button
          onClick={() => update({ italic: !value.italic })}
          className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
            value.italic
              ? 'border-brand-500 bg-brand-500/20 text-brand-400'
              : 'border-gray-700 text-gray-500 hover:border-gray-600'
          )}
          title="In nghiêng"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Align */}
        {(['left', 'center', 'right'] as const).map((a) => {
          const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
          return (
            <button
              key={a}
              onClick={() => update({ align: a })}
              className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
                value.align === a
                  ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600'
              )}
              title={`Căn ${a === 'left' ? 'trái' : a === 'center' ? 'giữa' : 'phải'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Background color */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-500">Nền:</span>
          <input
            type="color"
            value={value.backgroundColor || '#ffffff'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="w-8 h-8 rounded border border-gray-700 bg-transparent cursor-pointer p-0.5"
            title="Màu nền hộp chữ"
          />
          <button
            onClick={() => update({ backgroundColor: null })}
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded border transition-colors',
              value.backgroundColor === null
                ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                : 'border-gray-700 text-gray-500 hover:border-gray-600'
            )}
          >
            None
          </button>
        </div>
      </div>

      {/* Font size slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Thanh kéo cỡ chữ</span>
          <span className="font-mono text-gray-300">{Math.round(value.fontSize)}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={300}
          step={1}
          value={Math.round(value.fontSize)}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="w-full accent-brand-500"
        />
      </div>

      {/* Box dimensions & Quick Auto-fit helpers */}
      <div className="pt-2 border-t border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400 font-medium">Kích thước khung chữ:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => update({ height: (value.height || 100) + 40 })}
              className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1"
              title="Tăng chiều cao thêm 40px"
            >
              <Maximize2 className="w-2.5 h-2.5" />
              <span>+40px cao</span>
            </button>
            <button
              type="button"
              onClick={() => update({ fontSize: Math.max(12, (value.fontSize || 48) - 4) })}
              className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1"
              title="Thu nhỏ cỡ chữ đi 4px"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>-4px chữ</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 font-medium block mb-1">Rộng (px)</label>
            <input
              type="number"
              min={100}
              max={3000}
              step={10}
              value={Math.round(value.width || 400)}
              onChange={(e) => update({ width: Math.max(100, Number(e.target.value)) })}
              className="input-field py-1.5 text-xs text-center w-full"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium block mb-1">Cao (px)</label>
            <input
              type="number"
              min={40}
              max={3000}
              step={10}
              value={Math.round(value.height || 100)}
              onChange={(e) => update({ height: Math.max(40, Number(e.target.value)) })}
              className="input-field py-1.5 text-xs text-center w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper: Apply color to a specific range of characters ─────────────────────
function applyColorToSelection(
  fullText: string,
  start: number,
  end: number,
  newColor: string,
  currentSegments?: CaptionSegment[],
  defaultColor = '#ffffff'
): CaptionSegment[] {
  if (!fullText) return []
  if (start >= end || start < 0 || end > fullText.length) {
    return [{ text: fullText, color: newColor }]
  }

  const charColors: string[] = new Array(fullText.length).fill(defaultColor)

  if (currentSegments && currentSegments.length > 0) {
    let charIdx = 0
    for (const seg of currentSegments) {
      const segColor = seg.color || defaultColor
      for (let i = 0; i < seg.text.length && charIdx < fullText.length; i++) {
        charColors[charIdx] = segColor
        charIdx++
      }
    }
  }

  for (let i = start; i < end; i++) {
    charColors[i] = newColor
  }

  const newSegments: CaptionSegment[] = []
  let curColor = charColors[0]
  let curRun = ''

  for (let i = 0; i < fullText.length; i++) {
    if (charColors[i] === curColor) {
      curRun += fullText[i]
    } else {
      if (curRun) newSegments.push({ text: curRun, color: curColor })
      curColor = charColors[i]
      curRun = fullText[i]
    }
  }
  if (curRun) newSegments.push({ text: curRun, color: curColor })

  return newSegments
}
