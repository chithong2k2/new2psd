import { useState } from 'react'
import clsx from 'clsx'
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, ChevronDown, Palette } from 'lucide-react'
import type { CaptionStyle } from '../types'
import { AVAILABLE_FONTS } from '../types'

interface AdvancedCaptionEditorProps {
  value: CaptionStyle
  onChange: (v: CaptionStyle) => void
  disabled?: boolean
}

export function AdvancedCaptionEditor({ value, onChange, disabled }: AdvancedCaptionEditorProps) {
  const [showFontMenu, setShowFontMenu] = useState(false)
  const maxLen = 500
  const pct = Math.min(100, Math.round((value.text.length / maxLen) * 100))

  const update = (patch: Partial<CaptionStyle>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3">
      {/* Text area */}
      <textarea
        value={value.text}
        onChange={(e) => update({ text: e.target.value })}
        disabled={disabled}
        rows={4}
        placeholder="Nhập nội dung caption..."
        className="input-field resize-none leading-relaxed text-sm"
        maxLength={maxLen + 50}
      />
      {/* Char count bar */}
      <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all',
          value.text.length > maxLen ? 'bg-red-500' : value.text.length > maxLen * 0.85 ? 'bg-yellow-500' : 'bg-brand-500')}
          style={{ width: `${pct}%` }} />
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
            <ChevronDown className={clsx('w-3.5 h-3.5 text-gray-500 transition-transform', showFontMenu && 'rotate-180')} />
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-20 shadow-xl">
              {AVAILABLE_FONTS.map((f) => (
                <button key={f}
                  onClick={() => { update({ fontFamily: f }); setShowFontMenu(false) }}
                  className={clsx('w-full px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors',
                    value.fontFamily === f ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300')}
                  style={{ fontFamily: f }}>
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font size */}
        <div className="w-24 flex items-center gap-1">
          <input
            type="number" min={8} max={400} step={1}
            value={Math.round(value.fontSize)}
            onChange={(e) => update({ fontSize: Math.max(8, Math.min(400, Number(e.target.value))) })}
            className="input-field py-2 text-sm text-center w-full"
          />
        </div>
      </div>

      {/* Typography row 2: Bold, Italic, Align, Color */}
      <div className="flex items-center gap-2">
        {/* Bold */}
        <button onClick={() => update({ bold: !value.bold })}
          className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
            value.bold ? 'border-brand-500 bg-brand-500/20 text-brand-400' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
          <Bold className="w-4 h-4" />
        </button>

        {/* Italic */}
        <button onClick={() => update({ italic: !value.italic })}
          className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
            value.italic ? 'border-brand-500 bg-brand-500/20 text-brand-400' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Align */}
        {(['left','center','right'] as const).map((a) => {
          const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
          return (
            <button key={a} onClick={() => update({ align: a })}
              className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
                value.align === a ? 'border-brand-500 bg-brand-500/20 text-brand-400' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
              <Icon className="w-4 h-4" />
            </button>
          )
        })}

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Text color */}
        <div className="flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-gray-600" />
          <div className="relative">
            <input
              type="color" value={value.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-9 h-9 rounded-lg border border-gray-700 bg-transparent cursor-pointer p-0.5"
              title="Màu chữ"
            />
          </div>
        </div>

        {/* Background color */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-600">Nền:</span>
          <input
            type="color"
            value={value.backgroundColor || '#ffffff'}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="w-8 h-8 rounded border border-gray-700 bg-transparent cursor-pointer p-0.5"
            title="Màu nền"
          />
          <button
            onClick={() => update({ backgroundColor: null })}
            className={clsx('text-xs px-1.5 py-0.5 rounded border transition-colors',
              value.backgroundColor === null ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-600')}
          >
            None
          </button>
        </div>
      </div>

      {/* Font size slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Cỡ chữ</span>
          <span>{Math.round(value.fontSize)}px</span>
        </div>
        <input
          type="range" min={8} max={300} step={1}
          value={Math.round(value.fontSize)}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="w-full accent-brand-500"
        />
      </div>

      {/* Box dimensions (Canva/Photoshop sizing) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Rộng khung (px)</label>
          <input
            type="number"
            min={100}
            max={3000}
            step={10}
            value={Math.round(value.width || 400)}
            onChange={(e) => update({ width: Math.max(100, Number(e.target.value)) })}
            className="input-field py-1.5 text-xs text-center w-full"
            title="Kéo các điểm handle trên preview hoặc gõ số trực tiếp"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Cao khung (px)</label>
          <input
            type="number"
            min={40}
            max={3000}
            step={10}
            value={Math.round(value.height || 100)}
            onChange={(e) => update({ height: Math.max(40, Number(e.target.value)) })}
            className="input-field py-1.5 text-xs text-center w-full"
            title="Kéo các điểm handle trên preview hoặc gõ số trực tiếp"
          />
        </div>
      </div>
    </div>
  )
}
