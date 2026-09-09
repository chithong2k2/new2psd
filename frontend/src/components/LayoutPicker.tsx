import clsx from 'clsx'
import { LAYOUTS, type LayoutId, type LayoutOption } from '../types'

interface LayoutPickerProps {
  value: LayoutId
  onChange: (id: LayoutId) => void
}

export function LayoutPicker({ value, onChange }: LayoutPickerProps) {
  return (
    <div className="space-y-2">
      <p className="section-label">Bố cục ảnh</p>
      <div className="grid grid-cols-4 gap-2">
        {LAYOUTS.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            selected={value === layout.id}
            onClick={() => onChange(layout.id)}
          />
        ))}
      </div>
    </div>
  )
}

function LayoutCard({ layout, selected, onClick }: {
  layout: LayoutOption; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-xs',
        selected
          ? 'border-brand-500 bg-brand-500/10 text-brand-400'
          : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
      )}
    >
      <LayoutPreview layout={layout} selected={selected} />
      <span className="leading-tight text-center">{layout.label}</span>
    </button>
  )
}

function LayoutPreview({ layout, selected }: { layout: LayoutOption; selected: boolean }) {
  const bg = selected ? 'bg-brand-500/40' : 'bg-gray-600'
  const w = 36, h = 24, gap = 2

  // Draw mini layout diagram
  const rects = getMiniRects(layout.id, w, h, gap)

  return (
    <div className="relative" style={{ width: w, height: h }}>
      {rects.map((r, i) => (
        <div
          key={i}
          className={clsx('absolute rounded-sm', bg)}
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        />
      ))}
    </div>
  )
}

function getMiniRects(id: LayoutId, W: number, H: number, g: number) {
  switch (id) {
    case 'side-by-side': {
      const w = Math.floor((W - g) / 2)
      return [{ x: 0, y: 0, w, h: H }, { x: w + g, y: 0, w: W - w - g, h: H }]
    }
    case 'left-big': {
      const bw = Math.floor(W * 0.65)
      return [{ x: 0, y: 0, w: bw, h: H }, { x: bw + g, y: 0, w: W - bw - g, h: H }]
    }
    case 'right-big': {
      const sw = Math.floor(W * 0.35)
      return [{ x: 0, y: 0, w: sw, h: H }, { x: sw + g, y: 0, w: W - sw - g, h: H }]
    }
    case 'top-bottom': {
      const h1 = Math.floor((H - g) / 2)
      return [{ x: 0, y: 0, w: W, h: h1 }, { x: 0, y: h1 + g, w: W, h: H - h1 - g }]
    }
    case '3-equal': {
      const w = Math.floor((W - g * 2) / 3)
      return [{ x: 0, y: 0, w, h: H }, { x: w + g, y: 0, w, h: H }, { x: (w + g) * 2, y: 0, w: W - (w + g) * 2, h: H }]
    }
    case '1-top-2-bottom': {
      const th = Math.floor(H * 0.6), bh = H - th - g, bw = Math.floor((W - g) / 2)
      return [
        { x: 0, y: 0, w: W, h: th },
        { x: 0, y: th + g, w: bw, h: bh },
        { x: bw + g, y: th + g, w: W - bw - g, h: bh },
      ]
    }
    default:
      return [{ x: 0, y: 0, w: W, h: H }]
  }
}
