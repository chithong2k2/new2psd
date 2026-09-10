import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ImageIcon, Loader2, Move, Maximize2, Sparkles } from 'lucide-react'
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
  onCaptionChange?: (patch: Partial<CaptionStyle>) => void
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
  onCaptionChange,
}: DragPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textMeasureRef = useRef<HTMLDivElement>(null)
  const [displayScale, setDisplayScale] = useState(1)

  // Drag modes: move box OR resize from one of 8 Canva handles
  type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null
  const [dragMode, setDragMode] = useState<DragMode>(null)
  const dragStart = useRef<{
    mx: number
    my: number
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  const [isOverflowing, setIsOverflowing] = useState(false)

  // Compute display scale: preview client width / PSD width
  useEffect(() => {
    const el = containerRef.current
    if (!el || !psdWidth) return
    const obs = new ResizeObserver(() => setDisplayScale(el.clientWidth / psdWidth))
    obs.observe(el)
    setDisplayScale(el.clientWidth / psdWidth)
    return () => obs.disconnect()
  }, [psdWidth])

  // Measure text overflow whenever text, fontSize, dimensions change
  useEffect(() => {
    const el = textMeasureRef.current
    if (!el) return
    const overflow = el.scrollHeight > el.clientHeight + 2
    setIsOverflowing(overflow)
  }, [captionStyle.text, captionStyle.fontSize, captionStyle.width, captionStyle.height, displayScale])

  // Real-time CSS coordinates & styling for Caption
  const capStyle = {
    left: captionStyle.x * displayScale,
    top: captionStyle.y * displayScale,
    width: (captionStyle.width || 400) * displayScale,
    height: (captionStyle.height || 100) * displayScale,
  }

  // Handle start dragging for moving or resizing handles
  const handleStartDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    setDragMode(mode)
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      x: captionStyle.x,
      y: captionStyle.y,
      w: captionStyle.width || 400,
      h: captionStyle.height || 100,
    }
  }

  useEffect(() => {
    if (!dragMode) return
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current || !displayScale) return
      const dx = (e.clientX - dragStart.current.mx) / displayScale
      const dy = (e.clientY - dragStart.current.my) / displayScale

      const minW = 120
      const minH = 50
      let nx = dragStart.current.x
      let ny = dragStart.current.y
      let nw = dragStart.current.w
      let nh = dragStart.current.h

      if (dragMode === 'move') {
        nx = Math.max(0, Math.min(psdWidth - nw, dragStart.current.x + dx))
        ny = Math.max(0, Math.min(psdHeight - nh, dragStart.current.y + dy))
        if (onCaptionChange) {
          onCaptionChange({ x: Math.round(nx), y: Math.round(ny) })
        } else {
          onCaptionMove(Math.round(nx), Math.round(ny))
        }
        return
      }

      // Horizontal resizing
      if (dragMode.includes('e')) {
        nw = Math.max(minW, Math.min(psdWidth - nx, dragStart.current.w + dx))
      } else if (dragMode.includes('w')) {
        const potentialW = dragStart.current.w - dx
        if (potentialW >= minW && dragStart.current.x + dx >= 0) {
          nw = potentialW
          nx = dragStart.current.x + dx
        }
      }

      // Vertical resizing
      if (dragMode.includes('s')) {
        nh = Math.max(minH, Math.min(psdHeight - ny, dragStart.current.h + dy))
      } else if (dragMode.includes('n')) {
        const potentialH = dragStart.current.h - dy
        if (potentialH >= minH && dragStart.current.y + dy >= 0) {
          nh = potentialH
          ny = dragStart.current.y + dy
        }
      }

      if (onCaptionChange) {
        onCaptionChange({
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(nw),
          height: Math.round(nh),
        })
      }
    }

    const onUp = () => setDragMode(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragMode, displayScale, psdWidth, psdHeight, onCaptionMove, onCaptionChange])

  // Auto-expand height so text is NEVER clipped
  const handleAutoExpandHeight = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const el = textMeasureRef.current
    if (!el || !displayScale || !onCaptionChange) return
    const neededH = Math.round(el.scrollHeight / displayScale) + 24
    onCaptionChange({ height: Math.max(neededH, (captionStyle.height || 100)) })
  }

  // Auto-fit font size to comfortably fit inside the current box
  const handleAutoFitFontSize = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const el = textMeasureRef.current
    if (!el || !onCaptionChange) return
    let curSize = captionStyle.fontSize || 48
    if (el.scrollHeight > el.clientHeight && curSize > 16) {
      const ratio = el.clientHeight / el.scrollHeight
      const newSize = Math.max(16, Math.floor(curSize * ratio * 0.94))
      onCaptionChange({ fontSize: newSize })
    }
  }

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

        {/* ── LAYER 4: Real-time Interactive Caption Frame (Canva / Photoshop style) ── */}
        {psdWidth > 0 && (bgImageSrc || hasImages || templateBgPng) && (
          <div
            onMouseDown={(e) => handleStartDrag(e, 'move')}
            style={{
              ...capStyle,
              backgroundColor: captionStyle.backgroundColor || 'transparent',
            }}
            className={`absolute border-2 rounded transition-shadow z-30 ${
              dragMode === 'move'
                ? 'border-blue-500 bg-blue-500/10 cursor-grabbing ring-2 ring-blue-400/40 shadow-2xl'
                : dragMode
                ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-400/30 shadow-xl'
                : isOverflowing
                ? 'border-amber-400/90 bg-amber-400/5 hover:border-amber-400 hover:bg-amber-400/10 cursor-grab'
                : 'border-dashed border-yellow-400/80 bg-yellow-400/5 cursor-grab hover:border-yellow-400 hover:bg-yellow-400/10'
            }`}
          >
            {/* Realtime Live Text Render */}
            <div
              ref={textMeasureRef}
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

            {/* ── 8 CANVA / PHOTOSHOP RESIZE HANDLES ── */}
            {/* Corner handles (NW, NE, SE, SW) */}
            <div
              onMouseDown={(e) => handleStartDrag(e, 'nw')}
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-sm shadow cursor-nwse-resize z-40 hover:scale-125 transition-transform"
              title="Kéo co giãn góc trên - trái"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 'ne')}
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-sm shadow cursor-nesw-resize z-40 hover:scale-125 transition-transform"
              title="Kéo co giãn góc trên - phải"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 'se')}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-sm shadow cursor-nwse-resize z-40 hover:scale-125 transition-transform"
              title="Kéo co giãn góc dưới - phải"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 'sw')}
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-sm shadow cursor-nesw-resize z-40 hover:scale-125 transition-transform"
              title="Kéo co giãn góc dưới - trái"
            />

            {/* Edge handles (Canva signature pills): N, S, E, W */}
            <div
              onMouseDown={(e) => handleStartDrag(e, 'n')}
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-white border-2 border-blue-500 rounded-full shadow cursor-ns-resize z-40 hover:scale-125 transition-transform"
              title="Kéo dãn chiều cao trên"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 's')}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-white border-2 border-blue-500 rounded-full shadow cursor-ns-resize z-40 hover:scale-125 transition-transform"
              title="Kéo dãn chiều cao dưới"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 'w')}
              className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-6 bg-white border-2 border-blue-500 rounded-full shadow cursor-ew-resize z-40 hover:scale-125 transition-transform"
              title="Kéo dãn chiều rộng trái"
            />
            <div
              onMouseDown={(e) => handleStartDrag(e, 'e')}
              className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-6 bg-white border-2 border-blue-500 rounded-full shadow cursor-ew-resize z-40 hover:scale-125 transition-transform"
              title="Kéo dãn chiều rộng phải"
            />

            {/* ── Canva-style Floating Toolbar on Top ── */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 pointer-events-auto z-40">
              <div className="flex items-center gap-1 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap shadow-md">
                <Move className="w-2.5 h-2.5" />
                <span>Kéo dời / Co giãn</span>
              </div>
              <span className="bg-black/85 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono shadow">
                {Math.round(captionStyle.width || 400)} × {Math.round(captionStyle.height || 100)}
              </span>

              {/* Overflow alerts & Quick Auto-fit tools */}
              {isOverflowing && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleAutoExpandHeight}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow animate-pulse"
                  title="Tự động kéo dài khung xuống để hiện đủ toàn bộ chữ"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                  <span>↕ Mở rộng khung</span>
                </button>
              )}
              {isOverflowing && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={handleAutoFitFontSize}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow"
                  title="Tự động thu nhỏ cỡ chữ để vừa khít khung hiện tại"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>⚡ Co vừa chữ</span>
                </button>
              )}
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
