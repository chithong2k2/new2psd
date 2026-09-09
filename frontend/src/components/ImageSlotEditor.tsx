import { useEffect, useRef, useState } from 'react'
import { Upload, Link2, X, ImageOff, Move, Globe, Sparkles, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { ImageSlot, ArticleImage } from '../types'
import { uploadImage, fetchImageFromUrl, searchRelatedNews } from '../api'

interface ImageSlotProps {
  index: number
  slot: ImageSlot | null
  projectId: string
  aspectRatio: number // target width / target height of this slot in template
  mainArticleImages: ArticleImage[]
  relatedImages: ArticleImage[]
  articleTitle?: string
  onUpdate: (slot: ImageSlot | null) => void
  onMoreRelatedFound?: (newImages: ArticleImage[]) => void
}

export function ImageSlotEditor({
  index,
  slot,
  projectId,
  aspectRatio = 16 / 9,
  mainArticleImages = [],
  relatedImages = [],
  articleTitle,
  onUpdate,
  onMoreRelatedFound,
}: ImageSlotProps) {
  const [mode, setMode] = useState<'article' | 'related' | 'upload' | 'url'>('article')
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchingRelated, setSearchingRelated] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const result = await uploadImage(projectId, file)
      onUpdate({ url: result.url, focusX: 0.5, focusY: 0.5, isLocal: true })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return
    setLoading(true)
    try {
      const result = await fetchImageFromUrl(projectId, urlInput.trim())
      onUpdate({ url: result.url, focusX: 0.5, focusY: 0.5, isLocal: true })
      setUrlInput('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchMoreRelated = async () => {
    setSearchingRelated(true)
    try {
      const res = await searchRelatedNews(projectId)
      if (onMoreRelatedFound && res.relatedImages) {
        onMoreRelatedFound(res.relatedImages)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSearchingRelated(false)
    }
  }

  const getDisplayUrl = (url: string) =>
    url.startsWith('/api/') ? url : `/api/projects/${projectId}/proxy-image?url=${encodeURIComponent(url)}`

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-800/40">
      {/* Header with 4 selection modes */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900/60">
        <span className="text-xs font-semibold text-gray-300">Ảnh {index + 1}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('article')}
            className={clsx(
              'px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1',
              mode === 'article'
                ? 'bg-brand-500/20 text-brand-400 font-medium'
                : 'text-gray-500 hover:text-gray-300'
            )}
            title="Ảnh từ bài viết gốc (đã lọc sạch quảng cáo)"
          >
            Bài gốc ({mainArticleImages.length})
          </button>

          <button
            onClick={() => setMode('related')}
            className={clsx(
              'px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1',
              mode === 'related'
                ? 'bg-purple-500/20 text-purple-400 font-medium'
                : 'text-gray-500 hover:text-gray-300'
            )}
            title="Ảnh từ các báo khác cùng sự kiện (đối chiếu alt chuẩn xác)"
          >
            <Globe className="w-3 h-3" />
            Báo khác ({relatedImages.length})
          </button>

          <button
            onClick={() => setMode('upload')}
            className={clsx(
              'px-2 py-0.5 rounded text-xs transition-colors',
              mode === 'upload' ? 'bg-brand-500/20 text-brand-400 font-medium' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            Upload
          </button>

          <button
            onClick={() => setMode('url')}
            className={clsx(
              'px-2 py-0.5 rounded text-xs transition-colors',
              mode === 'url' ? 'bg-brand-500/20 text-brand-400 font-medium' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            URL
          </button>
        </div>
      </div>

      {/* Interactive Crop Frame Area */}
      {slot?.url ? (
        <div className="p-3 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Move className="w-3 h-3 text-brand-400" />
              Kéo khung hoặc ảnh để căn đúng vị trí template:
            </span>
            <button
              onClick={() => onUpdate(null)}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Bỏ ảnh
            </button>
          </div>

          <ImageCropBox
            imageUrl={getDisplayUrl(slot.url)}
            targetAspect={aspectRatio}
            focusX={slot.focusX ?? 0.5}
            focusY={slot.focusY ?? 0.5}
            onChange={(fx, fy) => onUpdate({ ...slot, focusX: fx, focusY: fy })}
          />
        </div>
      ) : (
        <div className="aspect-video flex flex-col items-center justify-center text-gray-600 gap-1 bg-gray-900/20">
          <ImageOff className="w-7 h-7 stroke-[1.5]" />
          <span className="text-xs">Chưa chọn ảnh cho ô này</span>
        </div>
      )}

      {/* Mode content */}
      <div className="p-3 space-y-2">
        {/* TAB 1: Main Article Images */}
        {mode === 'article' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {mainArticleImages.length === 0 && (
                <p className="col-span-3 text-xs text-gray-500 text-center py-3">Chưa có ảnh từ bài báo</p>
              )}
              {mainArticleImages.map((img) => (
                <button
                  key={img.url}
                  onClick={() => onUpdate({ url: img.url, focusX: 0.5, focusY: 0.5 })}
                  title={img.caption || 'Ảnh bài gốc'}
                  className={clsx(
                    'relative aspect-video rounded overflow-hidden border-2 transition-all group text-left',
                    slot?.url === img.url
                      ? 'border-brand-500 ring-2 ring-brand-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  )}
                >
                  <img
                    src={getDisplayUrl(img.url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = ''
                    }}
                  />
                  {img.recommended && (
                    <span className="absolute top-1 left-1 bg-brand-500 text-white text-[8px] px-1 rounded font-bold shadow">
                      Đề xuất
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 italic">
              * Đã tự động lọc sạch các banner quảng cáo, avatar và icon.
            </p>
          </div>
        )}

        {/* TAB 2: Related News Images from other major outlets */}
        {mode === 'related' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Góc ảnh từ các báo khác cùng sự kiện:
              </span>
              <button
                onClick={handleSearchMoreRelated}
                disabled={searchingRelated}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {searchingRelated ? 'Đang quét...' : 'Quét thêm'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {relatedImages.length === 0 && !searchingRelated && (
                <div className="col-span-3 text-center py-4 space-y-1">
                  <p className="text-xs text-gray-500">Chưa có ảnh báo khác</p>
                  <button
                    onClick={handleSearchMoreRelated}
                    className="text-xs text-purple-400 underline hover:text-purple-300"
                  >
                    Bấm để tìm thêm góc ảnh cùng sự kiện
                  </button>
                </div>
              )}

              {relatedImages.map((img) => (
                <button
                  key={img.url}
                  onClick={() => onUpdate({ url: img.url, focusX: 0.5, focusY: 0.5 })}
                  title={`${img.caption || 'Ảnh liên quan'} (Nguồn: ${img.sourceName || 'Báo điện tử'})`}
                  className={clsx(
                    'relative aspect-video rounded overflow-hidden border-2 transition-all group text-left',
                    slot?.url === img.url
                      ? 'border-purple-500 ring-2 ring-purple-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  )}
                >
                  <img
                    src={getDisplayUrl(img.url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = ''
                    }}
                  />
                  {img.sourceName && (
                    <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] text-gray-300 px-1 py-0.5 truncate text-center">
                      {img.sourceName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Upload from Disk */}
        {mode === 'upload' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-600 rounded-lg text-xs text-gray-300 hover:border-brand-500 hover:text-brand-400 transition-colors"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {loading ? 'Đang tải lên...' : 'Chọn file từ máy tính'}
            </button>
          </div>
        )}

        {/* TAB 4: Paste URL */}
        {mode === 'url' && (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
              placeholder="Dán link ảnh https://..."
              className="input-field text-xs flex-1 py-1.5"
            />
            <button
              onClick={handleUrlFetch}
              disabled={loading || !urlInput.trim()}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              {loading ? '...' : <Link2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ImageCropBox: Shows the full image with a darkened mask and movable cutout frame ───────────
interface ImageCropBoxProps {
  imageUrl: string
  targetAspect: number
  focusX: number // 0 (left/top) to 1 (right/bottom)
  focusY: number
  onChange: (fx: number, fy: number) => void
}

function ImageCropBox({ imageUrl, targetAspect, focusX, focusY, onChange }: ImageCropBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; initFx: number; initFy: number } | null>(null)

  // Natural aspect of the image
  const imgAspect = imgDim ? imgDim.w / imgDim.h : 1

  // Container height based on image aspect, clamped to max height
  const containerAspect = imgDim ? Math.max(0.5, Math.min(2.5, imgAspect)) : 16 / 9

  // Calculate crop window size inside container
  let frameW = 100
  let frameH = 100

  if (targetAspect > imgAspect) {
    frameW = 100
    frameH = (imgAspect / targetAspect) * 100
  } else {
    frameH = 100
    frameW = (targetAspect / imgAspect) * 100
  }

  const maxLeft = 100 - frameW
  const maxTop = 100 - frameH
  const frameLeft = focusX * maxLeft
  const frameTop = focusY * maxTop

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initFx: focusX,
      initFy: focusY,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const box = containerRef.current.getBoundingClientRect()

      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY

      const pixelTravelX = (maxLeft / 100) * box.width
      const pixelTravelY = (maxTop / 100) * box.height

      const dfx = pixelTravelX > 0 ? dx / pixelTravelX : 0
      const dfy = pixelTravelY > 0 ? dy / pixelTravelY : 0

      const nextFx = Math.max(0, Math.min(1, dragRef.current.initFx + dfx))
      const nextFy = Math.max(0, Math.min(1, dragRef.current.initFy + dfy))

      onChange(nextFx, nextFy)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, maxLeft, maxTop, onChange])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden bg-black select-none border border-gray-700"
      style={{ aspectRatio: `${containerAspect}` }}
    >
      {/* Full Image */}
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        onLoad={(e) => {
          setImgDim({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })
        }}
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Dark Mask Covering Areas Outside the Crop Frame */}
      {imgDim && (
        <>
          <div className="absolute left-0 right-0 top-0 bg-black/65 pointer-events-none" style={{ height: `${frameTop}%` }} />
          <div className="absolute left-0 right-0 bottom-0 bg-black/65 pointer-events-none" style={{ height: `${100 - (frameTop + frameH)}%` }} />
          <div className="absolute left-0 bg-black/65 pointer-events-none" style={{ top: `${frameTop}%`, height: `${frameH}%`, width: `${frameLeft}%` }} />
          <div className="absolute right-0 bg-black/65 pointer-events-none" style={{ top: `${frameTop}%`, height: `${frameH}%`, width: `${100 - (frameLeft + frameW)}%` }} />

          {/* Draggable Cutout Crop Window */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              left: `${frameLeft}%`,
              top: `${frameTop}%`,
              width: `${frameW}%`,
              height: `${frameH}%`,
            }}
            className={clsx(
              'absolute border-2 shadow-2xl transition-shadow',
              isDragging
                ? 'border-brand-400 ring-2 ring-brand-400/40 cursor-grabbing'
                : 'border-white ring-1 ring-black/50 cursor-grab hover:border-brand-300'
            )}
          >
            {/* Grid Lines inside crop window */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            {/* Hint label */}
            <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded flex items-center gap-0.5 pointer-events-none">
              <Move className="w-2.5 h-2.5" /> Vùng hiển thị PSD
            </div>
          </div>
        </>
      )}
    </div>
  )
}
