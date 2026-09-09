import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ImageIcon, Loader2, Move } from 'lucide-react'
import type { CaptionStyle, ImageSlot, LayerBounds, LayoutId } from '../types'

interface DragPreviewProps {
  previewBase64: string | null
  basePreviewBase64?: string | null
  templateBgPng?: string | null
  templateFgPng?: string | null
  imageLayerBounds?: LayerBounds | null
  imageSlots: (ImageSlot | null)[]
  layout: LayoutId
  loading: boolean
  projectId: string | null
  psdWidth: number
  psdHeight: number
  captionStyle: CaptionStyle
  onCaptionMove: (x: number, y: number) => void
}

export function DragPreview({
  previewBase64,
  basePreviewBase64,
  templateBgPng,
  templateFgPng,
  imageLayerBounds,
  imageSlots,
  layout,
  loading,
  projectId,
  psdWidth,
  psdHeight,
  captionStyle,
  onCaptionMove,
}: DragPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)
  const [isDraggingCaption, setIsDraggingCaption] = useState(false)
  const captionDrag = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)

  // Compute display scale: preview client width / PSD width
  useEffect(() => {
    const el = containerRef.current
    if (!el || !psdWidth) return
    const obs = new ResizeObserver(() => setDisplayScale(el.clientWidth / psdWidth))
    obs.observe(el)
    setDisplayScale(el.clientWidth / psdWidth)
    return () => obs.disconnect()
  }, [psdWidth])

  // Real-time CSS coordinates & styling for Caption
  const capStyle = {
    left: captionStyle.x * displayScale,
    top: captionStyle.y * displayScale,
    width: captionStyle.width * displayScale,
    height: captionStyle.height * displayScale,
  }

  const handleCaptionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingCaption(true)
    captionDrag.current = { mx: e.clientX, my: e.clientY, cx: captionStyle.x, cy: captionStyle.y }
  }

  useEffect(() => {
    if (!isDraggingCaption) return
    const onMove = (e: MouseEvent) => {
      if (!captionDrag.current || !displayScale) return
      const dx = (e.clientX - captionDrag.current.mx) / displayScale
      const dy = (e.clientY - captionDrag.current.my) / displayScale
      const nx = Math.max(0, Math.min(psdWidth - captionStyle.width, captionDrag.current.cx + dx))
      const ny = Math.max(0, Math.min(psdHeight - captionStyle.height, captionDrag.current.cy + dy))
      onCaptionMove(Math.round(nx), Math.round(ny))
    }
    const onUp = () => setIsDraggingCaption(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDraggingCaption, displayScale, psdWidth, psdHeight, captionStyle.width, captionStyle.height, onCaptionMove])

  const aspectRatio = psdWidth && psdHeight ? `${psdWidth} / ${psdHeight}` : '1 / 1'

  // Decide what image to show as fallback
  const hasBasePreview = Boolean(basePreviewBase64)
  const bgImageSrc = hasBasePreview
    ? `data:image/png;base64,${basePreviewBase64}`
    : previewBase64
    ? `data:image/png;base64,${previewBase64}`
    : null

  // Calculate font size in display pixels
  const liveFontSize = Math.max(8, captionStyle.fontSize * displayScale)
  const liveLineHeight = 1.3

  // Calculate slot layout rectangles inside the image layer bounds
  const hasImages = imageSlots.some(Boolean)
  const imgBounds = imageLayerBounds
  const boundsW = imgBounds ? imgBounds.right - imgBounds.left : psdWidth
  const boundsH = imgBounds ? imgBounds.bottom - imgBounds.top : psdHeight
  const slotRects = getLayoutRects(layout, boundsW, boundsH)

  return (
    <div className="flex flex-col gap-4">
      {/* Preview container */}
      <div
        ref={containerRef}
        className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden w-full select-none"
        style={{ aspectRatio }}
      >
        {/* ── LAYER 1: PSD Background (Layers located beneath NEWS_IMAGE) ── */}
        {templateBgPng && (
          <img
            src={`data:image/png;base64,${templateBgPng}`}
            alt="PSD Background"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0"
            draggable={false}
          />
        )}

        {/* If no templateBgPng but we have server preview composite, render as base fallback */}
        {!hasImages && bgImageSrc && (
          <img
            src={bgImageSrc}
            alt="PSD Preview"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0"
            draggable={false}
          />
        )}

        {/* ── LAYER 2: 100% Client-Side Realtime Photo Layer (NEWS_IMAGE layer) ── */}
        {imgBounds && hasImages && displayScale > 0 && (
          <div
            className="absolute pointer-events-none overflow-hidden z-10"
            style={{
              left: imgBounds.left * displayScale,
              top: imgBounds.top * displayScale,
              width: (imgBounds.right - imgBounds.left) * displayScale,
              height: (imgBounds.bottom - imgBounds.top) * displayScale,
            }}
          >
            {slotRects.map((rect, i) => {
              const slot = imageSlots[i]
              if (!slot?.url) return null
              const src = slot.url.startsWith('/api/')
                ? slot.url
                : `/api/projects/${projectId}/proxy-image?url=${encodeURIComponent(slot.url)}`

              return (
                <LiveImageSlot
                  key={`${slot.url}-${i}`}
                  imageUrl={src}
                  x={rect.x * displayScale}
                  y={rect.y * displayScale}
                  w={rect.w * displayScale}
                  h={rect.h * displayScale}
                  focusX={slot.focusX ?? 0.5}
                  focusY={slot.focusY ?? 0.5}
                />
              )
            })}
          </div>
        )}

        {/* ── LAYER 3: PSD Foreground (Borders, Branding, Foreground Artwork above NEWS_IMAGE) ── */}
        {templateFgPng && (
          <img
            src={`data:image/png;base64,${templateFgPng}`}
            alt="PSD Foreground"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
            draggable={false}
          />
        )}

        {/* Fallback if templateFgPng not available yet: server composite */}
        {!templateFgPng && bgImageSrc && hasImages && (
          <img
            src={bgImageSrc}
            alt="PSD Preview"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
            draggable={false}
          />
        )}

        {/* Non-intrusive background sync badge */}
        {loading && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-full border border-gray-700 text-brand-400 text-xs shadow z-40 pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Đang chuẩn bị file PSD...</span>
          </div>
        )}

        {/* Empty state */}
        {!bgImageSrc && !hasImages && !templateBgPng && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-700 z-10">
            <ImageIcon className="w-12 h-12" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400">Live Preview</p>
              <p className="text-xs text-gray-600 mt-1">Upload PSD → Chọn ảnh & căn góc</p>
            </div>
          </div>
        )}

        {/* ── LAYER 4: Real-time Interactive Caption Frame (NEWS_CAPTION layer) ── */}
        {psdWidth > 0 && (bgImageSrc || hasImages || templateBgPng) && (
          <div
            onMouseDown={handleCaptionMouseDown}
            style={{
              ...capStyle,
              backgroundColor: captionStyle.backgroundColor || 'transparent',
            }}
            className={`absolute border-2 rounded transition-shadow z-30 overflow-hidden ${
              isDraggingCaption
                ? 'border-yellow-400 bg-yellow-400/10 cursor-grabbing ring-2 ring-yellow-400/40 shadow-xl'
                : 'border-dashed border-yellow-400/80 bg-yellow-400/5 cursor-grab hover:border-yellow-400 hover:bg-yellow-400/10'
            }`}
          >
            {/* Realtime Live Text Render */}
            <div
              style={{
                fontFamily: `"${captionStyle.fontFamily}", Arial, sans-serif`,
                fontSize: `${liveFontSize}px`,
                fontWeight: captionStyle.bold ? 'bold' : 'normal',
                fontStyle: captionStyle.italic ? 'italic' : 'normal',
                color: captionStyle.color,
                textAlign: captionStyle.align,
                lineHeight: liveLineHeight,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: `${4 * displayScale}px`,
              }}
              className="w-full h-full pointer-events-none select-none overflow-hidden"
            >
              {captionStyle.text || '(Nhập nội dung caption...)'}
            </div>

            {/* Drag Handle Label */}
            <div className="absolute -top-5 left-0 flex items-center gap-1 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-semibold shadow">
              <Move className="w-2.5 h-2.5" />
              Caption (Kéo để dời)
            </div>

            {/* Coordinates tag */}
            <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1 rounded pointer-events-none">
              X: {captionStyle.x}, Y: {captionStyle.y}
            </div>
          </div>
        )}
      </div>

      {/* Hints & dimensions */}
      {psdWidth > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            Template: {psdWidth} × {psdHeight} px
          </span>
          <span className="text-yellow-500/90 font-medium">⚡ Kéo ảnh hoặc gõ chữ là cập nhật tức thì (0ms)</span>
        </div>
      )}

      {/* Export buttons */}
      {projectId && (
        <ExportActionButtons
          projectId={projectId}
          imageSlots={imageSlots}
          layout={layout}
          captionStyle={captionStyle}
        />
      )}
    </div>
  )
}

function LiveImageSlot({
  imageUrl,
  x,
  y,
  w,
  h,
  focusX,
  focusY,
}: {
  imageUrl: string
  x: number
  y: number
  w: number
  h: number
  focusX: number
  focusY: number
}) {
  const [naturalDim, setNaturalDim] = useState<{ w: number; h: number } | null>(null)

  // Calculate cover scaling and translation
  const imgW = naturalDim?.w || w
  const imgH = naturalDim?.h || h
  const scale = Math.max(w / imgW, h / imgH)
  const rendW = imgW * scale
  const rendH = imgH * scale

  // Shift according to focusX (0 to 1) and focusY (0 to 1)
  const maxShiftX = rendW - w
  const maxShiftY = rendH - h
  const shiftX = -(focusX * maxShiftX)
  const shiftY = -(focusY * maxShiftY)

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        onLoad={(e) => {
          setNaturalDim({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }}
        style={{
          position: 'absolute',
          width: rendW || '100%',
          height: rendH || '100%',
          transform: `translate(${shiftX}px, ${shiftY}px)`,
          maxWidth: 'none',
          maxHeight: 'none',
        }}
      />
    </div>
  )
}

function getLayoutRects(layout: LayoutId, W: number, H: number) {
  const gap = Math.round(Math.min(W, H) * 0.01)
  switch (layout) {
    case 'side-by-side': {
      const w = Math.floor((W - gap) / 2)
      return [{ x: 0, y: 0, w, h: H }, { x: w + gap, y: 0, w: W - w - gap, h: H }]
    }
    case 'left-big': {
      const bw = Math.floor(W * 0.65)
      return [{ x: 0, y: 0, w: bw, h: H }, { x: bw + gap, y: 0, w: W - bw - gap, h: H }]
    }
    case 'right-big': {
      const sw = Math.floor(W * 0.35)
      return [{ x: 0, y: 0, w: sw, h: H }, { x: sw + gap, y: 0, w: W - sw - gap, h: H }]
    }
    case 'top-bottom': {
      const h1 = Math.floor((H - gap) / 2)
      return [{ x: 0, y: 0, w: W, h: h1 }, { x: 0, y: h1 + gap, w: W, h: H - h1 - gap }]
    }
    case '3-equal': {
      const w = Math.floor((W - gap * 2) / 3)
      return [
        { x: 0, y: 0, w: H, h: H },
        { x: w + gap, y: 0, w: H, h: H },
        { x: (w + gap) * 2, y: 0, w: W - (w + gap) * 2, h: H },
      ]
    }
    case '1-top-2-bottom': {
      const th = Math.floor(H * 0.6), bh = H - th - gap, bw = Math.floor((W - gap) / 2)
      return [
        { x: 0, y: 0, w: W, h: th },
        { x: 0, y: th + gap, w: bw, h: bh },
        { x: bw + gap, y: th + gap, w: W - bw - gap, h: bh },
      ]
    }
    default:
      return [{ x: 0, y: 0, w: W, h: H }]
  }
}

function ExportActionButtons({
  projectId,
  imageSlots,
  layout,
  captionStyle,
}: {
  projectId: string
  imageSlots: (ImageSlot | null)[]
  layout: LayoutId
  captionStyle: CaptionStyle
}) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (type: 'png' | 'psd') => {
    setDownloading(true)
    try {
      const { prepareExport } = await import('../api')
      const filledSlots = imageSlots.filter(Boolean) as ImageSlot[]
      await prepareExport(projectId, filledSlots, layout, captionStyle)
      const link = document.createElement('a')
      link.href = `/api/projects/${projectId}/export/${type}`
      link.download = type === 'png' ? 'news2psd-export.png' : 'news2psd-modified.psd'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => handleDownload('png')}
        disabled={downloading}
        className="btn-primary justify-center"
      >
        <Download className="w-4 h-4" />
        {downloading ? 'Đang xuất PNG...' : 'Tải ảnh PNG'}
      </button>
      <button
        onClick={() => handleDownload('psd')}
        disabled={downloading}
        className="btn-secondary justify-center"
      >
        <Download className="w-4 h-4" />
        {downloading ? 'Đang xuất PSD...' : 'Tải file PSD'}
      </button>
    </div>
  )
}
