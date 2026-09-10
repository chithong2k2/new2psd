import { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, CheckCircle2, ChevronDown, Newspaper } from 'lucide-react'
import clsx from 'clsx'

import { UploadZone }             from '../components/UploadZone'
import { ArticleInput }           from '../components/ArticleInput'
import { LayoutPicker }           from '../components/LayoutPicker'
import { ImageSlotEditor }        from '../components/ImageSlotEditor'
import { AdvancedCaptionEditor }  from '../components/AdvancedCaptionEditor'
import { CaptionAiGenerator }      from '../components/CaptionAiGenerator'
import { DragPreview }            from '../components/DragPreview'
import { ErrorBanner }            from '../components/ErrorBanner'

import {
  createProject, uploadPsd, analyzeArticle, generatePreview,
} from '../api'

import {
  LAYOUTS, DEFAULT_CAPTION_STYLE,
  type Project, type ImageSlot, type CaptionStyle, type LayoutId, type PreviewResult,
} from '../types'

type Step = 'upload' | 'article' | 'layout' | 'caption'

export default function CreatePage() {
  const [project, setProject]       = useState<Project | null>(null)
  const [activeStep, setActiveStep] = useState<Step>('upload')
  const [error, setError]           = useState<string | null>(null)

  // Loading states
  const [uploading, setUploading]   = useState(false)
  const [analyzing, setAnalyzing]   = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // Layout & images
  const [layout, setLayout]         = useState<LayoutId>('single')
  const [imageSlots, setImageSlots] = useState<(ImageSlot | null)[]>([null])

  // Caption
  const [caption, setCaption]       = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)

  // Preview
  const [preview, setPreview]       = useState<PreviewResult | null>(null)

  // Debounce for caption drag
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Init project
  useEffect(() => {
    createProject().then((p) => setProject(p))
  }, [])

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 8000)
  }

  // ── STEP 1: Upload PSD ─────────────────────────────────────────────────────
  const handlePsd = useCallback(async (file: File) => {
    if (!project) return
    setUploading(true)
    try {
      const updated = await uploadPsd(project.id, file)
      setProject(updated)
      if (!updated.psdCompatible) {
        showError(updated.incompatibilityReason || 'PSD không tương thích')
        return
      }
      // Apply default caption style from PSD
      if (updated.defaultCaptionStyle) {
        setCaption((prev) => ({ ...prev, ...updated.defaultCaptionStyle, text: prev.text }))
      }
      setActiveStep('article')
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Upload thất bại')
    } finally { setUploading(false) }
  }, [project])

  // ── STEP 2: Analyze article ────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (url: string) => {
    if (!project) return
    setAnalyzing(true)
    try {
      const updated = await analyzeArticle(project.id, url)
      setProject(updated)
      setActiveStep('layout')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Không thể phân tích bài báo')
      showError(msg)
    } finally { setAnalyzing(false) }
  }, [project])

  // ── Layout change: reset slots ─────────────────────────────────────────────
  const handleLayoutChange = (id: LayoutId) => {
    const needed = LAYOUTS.find((l) => l.id === id)?.slots || 1
    setLayout(id)
    setImageSlots((prev) => {
      const next = [...prev]
      while (next.length < needed) next.push(null)
      return next.slice(0, needed)
    })
  }

  const updateSlot = (i: number, slot: ImageSlot | null) => {
    setImageSlots((prev) => {
      const n = [...prev]
      n[i] = slot
      return n
    })
  }

  // ── Generate preview ───────────────────────────────────────────────────────
  const doPreview = useCallback(async (cap?: CaptionStyle, customSlots?: (ImageSlot | null)[]) => {
    if (!project?.psdCompatible) return
    const currentSlots = customSlots || imageSlots
    const filledSlots = currentSlots.filter(Boolean) as ImageSlot[]
    if (filledSlots.length === 0) return

    setPreviewing(true)
    try {
      const result = await generatePreview(project.id, filledSlots, layout, cap ?? caption)
      setPreview(result)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (e instanceof Error ? e.message : 'Preview thất bại')
      showError(msg)
    } finally { setPreviewing(false) }
  }, [project, imageSlots, layout, caption])

  // Caption drag & resize: update instantly via React state / CSS with 0ms lag!
  const handleCaptionMove = useCallback((x: number, y: number) => {
    setCaption((prev) => ({ ...prev, x, y }))
  }, [])

  const handleCaptionChange = useCallback((patch: Partial<CaptionStyle>) => {
    setCaption((prev) => ({ ...prev, ...patch }))
  }, [])

  const steps: { key: Step; label: string; done: boolean }[] = [
    { key: 'upload',  label: 'Upload PSD',    done: !!project?.psdCompatible },
    { key: 'article', label: 'Bài báo',       done: !!project?.articleData },
    { key: 'layout',  label: 'Ảnh & Layout',  done: imageSlots.some(Boolean) },
    { key: 'caption', label: 'Caption',        done: !!preview },
  ]

  const mainArticleImages = project?.articleData?.images ?? []
  const relatedImages     = project?.articleData?.relatedImages ?? []
  const slotsNeeded       = LAYOUTS.find((l) => l.id === layout)?.slots ?? 1

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">News2PSD</span>
          </div>
          {/* Step nav */}
          <div className="hidden md:flex items-center gap-1">
            {steps.map((s, i) => (
              <button key={s.key}
                onClick={() => s.done || activeStep === s.key ? setActiveStep(s.key) : undefined}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  activeStep === s.key ? 'bg-brand-500/20 text-brand-400' :
                  s.done ? 'text-green-500 hover:bg-gray-800 cursor-pointer' : 'text-gray-600 cursor-default')}>
                {s.done
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i + 1}</span>}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT: Input steps ────────────────────────── */}
          <div className="space-y-4">

            {/* PSD Upload */}
            <Section title="PSD Template" step={1}
              active={activeStep === 'upload'} done={!!project?.psdCompatible}
              onClick={() => setActiveStep('upload')}>
              <UploadZone onFile={handlePsd} uploading={uploading}
                uploadedName={project?.psdFilename} uploadedSize={project?.psdFileSize}
                onReplace={() => setActiveStep('upload')} />
              {project?.psdCompatible && (
                <p className="flex items-center gap-2 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Compatible · {project.psdWidth} × {project.psdHeight} px
                </p>
              )}
              {project?.incompatibilityReason && !project.psdCompatible && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm">
                  <p className="font-semibold text-orange-300 mb-1">PSD không tương thích</p>
                  <p className="text-orange-400/80">{project.incompatibilityReason}</p>
                  <p className="text-gray-600 mt-1 text-xs">
                    Đặt tên layer: <code className="bg-gray-800 px-1 rounded">NEWS_IMAGE</code> và <code className="bg-gray-800 px-1 rounded">NEWS_CAPTION</code>
                  </p>
                </div>
              )}
            </Section>

            {/* Article */}
            <Section title="Bài báo" step={2}
              active={activeStep === 'article'} done={!!project?.articleData}
              disabled={!project?.psdCompatible}
              onClick={() => project?.psdCompatible && setActiveStep('article')}>
              <ArticleInput onAnalyze={handleAnalyze} analyzing={analyzing} done={!!project?.articleData} />
              {project?.articleData && (
                <div className="p-3 bg-gray-800/60 rounded-xl border border-gray-700">
                  <div className="flex items-start gap-2">
                    <Newspaper className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-200 line-clamp-2">{project.articleData.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{project.articleData.source} · {project.articleData.images.length} ảnh</p>
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* Layout + Images */}
            {project?.articleData && (
              <Section title="Ảnh & Bố cục" step={3}
                active={activeStep === 'layout'} done={imageSlots.some(Boolean)}
                onClick={() => setActiveStep('layout')}>
                <LayoutPicker value={layout} onChange={handleLayoutChange} />
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(slotsNeeded, 2)}, 1fr)` }}>
                  {Array.from({ length: slotsNeeded }).map((_, i) => {
                    // Compute aspect ratio of this slot based on layout
                    const bounds = project.imageLayerBounds
                    const totalW = bounds ? bounds.right - bounds.left : (project.psdWidth || 1080)
                    const totalH = bounds ? bounds.bottom - bounds.top : (project.psdHeight || 720)

                    let slotAspect = totalW / totalH
                    if (layout === 'side-by-side' || layout === '3-equal') {
                      const count = layout === 'side-by-side' ? 2 : 3
                      slotAspect = (totalW / count) / totalH
                    } else if (layout === 'top-bottom') {
                      slotAspect = totalW / (totalH / 2)
                    } else if (layout === 'left-big') {
                      slotAspect = (i === 0 ? totalW * 0.65 : totalW * 0.35) / totalH
                    } else if (layout === 'right-big') {
                      slotAspect = (i === 0 ? totalW * 0.35 : totalW * 0.65) / totalH
                    } else if (layout === '1-top-2-bottom') {
                      slotAspect = i === 0 ? totalW / (totalH * 0.6) : (totalW / 2) / (totalH * 0.4)
                    }

                    return (
                      <ImageSlotEditor key={i} index={i}
                        slot={imageSlots[i] ?? null}
                        projectId={project.id}
                        aspectRatio={slotAspect}
                        mainArticleImages={mainArticleImages}
                        relatedImages={relatedImages}
                        articleTitle={project.articleData?.title}
                        onUpdate={(slot) => updateSlot(i, slot)}
                        onMoreRelatedFound={(newImgs) => {
                          setProject((prev) => {
                            if (!prev || !prev.articleData) return prev
                            return {
                              ...prev,
                              articleData: {
                                ...prev.articleData,
                                relatedImages: newImgs,
                              },
                            }
                          })
                        }}
                      />
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Caption */}
            {imageSlots.some(Boolean) && (
              <Section title="Caption (Tự động cập nhật)" step={4}
                active={activeStep === 'caption'} done={!!preview}
                onClick={() => setActiveStep('caption')}>
                {project && (
                  <CaptionAiGenerator
                    projectId={project.id}
                    currentText={caption.text}
                    onApply={(sug) => {
                      setCaption((prev) => {
                        const tagText = sug.tag ? (sug.tag.endsWith(' ') ? sug.tag : `${sug.tag} `) : ''
                        const bodyText = sug.text ? sug.text.trimStart() : ''
                        const segments = sug.tag
                          ? [
                              { text: tagText, color: sug.tagColor || '#ef4444' },
                              { text: bodyText, color: prev.color || '#ffffff' },
                            ]
                          : undefined

                        return {
                          ...prev,
                          text: sug.fullText,
                          segments,
                          bold: true,
                        }
                      })
                    }}
                  />
                )}
                <AdvancedCaptionEditor value={caption} onChange={setCaption} disabled={false} />
                <div className="flex items-center gap-2 pt-1 text-xs text-yellow-400/90 font-medium">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  Realtime: Mọi thay đổi về text, cỡ chữ, màu sắc, vị trí hiển thị ngay tức thì!
                </div>
              </Section>
            )}

            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          </div>

          {/* ── RIGHT: Preview ───────────────────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <p className="section-label mb-4">Preview · Kéo caption để dời vị trí</p>
              <DragPreview
                previewBase64={preview?.previewPng ?? null}
                basePreviewBase64={preview?.basePreviewPng ?? null}
                templateBgPng={project?.templateBgPng}
                templateFgPng={project?.templateFgPng}
                imageLayerBounds={project?.imageLayerBounds}
                imageSlots={imageSlots}
                layout={layout}
                loading={previewing}
                projectId={project?.id ?? null}
                psdWidth={project?.psdWidth ?? 0}
                psdHeight={project?.psdHeight ?? 0}
                captionStyle={caption}
                onCaptionMove={handleCaptionMove}
                onCaptionChange={handleCaptionChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section accordion ─────────────────────────────────────────────────────────
function Section({ title, step, active, done, disabled, onClick, children }: {
  title: string; step: number; active: boolean; done: boolean
  disabled?: boolean; onClick?: () => void; children: React.ReactNode
}) {
  return (
    <div className={clsx('card overflow-hidden transition-all duration-200',
      active ? 'ring-1 ring-brand-500/40 shadow-lg shadow-brand-500/5' : '',
      disabled ? 'opacity-40 pointer-events-none' : '')}>
      <button className="w-full flex items-center justify-between p-4 text-left" onClick={onClick}>
        <div className="flex items-center gap-3">
          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
            done ? 'bg-green-500/20 text-green-400' : active ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-800 text-gray-600')}>
            {done ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          <span className={clsx('font-semibold text-sm',
            active ? 'text-white' : done ? 'text-gray-300' : 'text-gray-500')}>
            {title}
          </span>
        </div>
        <ChevronDown className={clsx('w-4 h-4 transition-transform text-gray-600', active && 'rotate-180')} />
      </button>
      {active && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800">
          <div className="pt-4 space-y-3">{children}</div>
        </div>
      )}
    </div>
  )
}
