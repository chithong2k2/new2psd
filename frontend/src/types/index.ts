// ─── Article ──────────────────────────────────────────────────────────────────
export interface ArticleImage {
  url: string
  caption: string
  width?: number
  height?: number
  recommended?: boolean
  sourceName?: string
  sourceArticleTitle?: string
  isFromMainArticle?: boolean
  similarityScore?: number
}

export interface ArticleData {
  title: string
  source: string
  url: string
  entities?: string[]
  images: ArticleImage[]
  relatedImages?: ArticleImage[]
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export type LayoutId =
  | 'single'
  | 'side-by-side'
  | 'left-big'
  | 'right-big'
  | 'top-bottom'
  | '3-equal'
  | '1-top-2-bottom'

export interface LayoutOption {
  id: LayoutId
  label: string
  slots: number
  icon: string // emoji / unicode
}

export const LAYOUTS: LayoutOption[] = [
  { id: 'single',          label: '1 ảnh',         slots: 1, icon: '▪' },
  { id: 'side-by-side',    label: '2 ngang đều',   slots: 2, icon: '▪▪' },
  { id: 'left-big',        label: '2 (trái lớn)',  slots: 2, icon: '▬▪' },
  { id: 'right-big',       label: '2 (phải lớn)',  slots: 2, icon: '▪▬' },
  { id: 'top-bottom',      label: '2 dọc',         slots: 2, icon: '⬜⬜' },
  { id: '3-equal',         label: '3 ngang đều',   slots: 3, icon: '▪▪▪' },
  { id: '1-top-2-bottom',  label: '1 trên + 2 dưới', slots: 3, icon: '▬⬜⬜' },
]

// ─── Image slot ───────────────────────────────────────────────────────────────
export interface ImageSlot {
  url: string              // article URL, local /api/... URL, or empty
  focusX: number           // 0-1 crop center X
  focusY: number           // 0-1 crop center Y
  caption?: string         // display caption in selector
  isLocal?: boolean        // true if uploaded from disk
}

// ─── Caption style ────────────────────────────────────────────────────────────
export interface CaptionSegment {
  text: string
  color?: string       // hex e.g. "#ef4444"
}

export interface CaptionStyle {
  text: string
  // position (PSD pixel coords)
  x: number
  y: number
  width: number
  height: number
  // typography
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  color: string        // hex e.g. "#000080"
  align: 'left' | 'center' | 'right'
  backgroundColor: string | null
  segments?: CaptionSegment[] // multi-color text segments like Canva/Photoshop
}

export interface CaptionToneOption {
  id: string
  label: string
  icon: string
  description: string
  tagColor: string
}

export interface CaptionSuggestion {
  tag: string
  text: string
  fullText: string
  wordCount: number
  tone: string
  toneLabel: string
  tagColor: string
  prefixColor: string
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  text: '',
  x: 0, y: 0, width: 400, height: 100,
  fontFamily: 'Montserrat',
  fontSize: 48,
  bold: true,
  italic: false,
  color: '#000000',
  align: 'left',
  backgroundColor: null,
}

export const AVAILABLE_FONTS = [
  'Montserrat',
  'Roboto',
  'OpenSans',
  'NotoSans',
  'Arial',
  'Georgia',
  'Times New Roman',
]

// ─── Project ──────────────────────────────────────────────────────────────────
export interface PsdLayer {
  name: string
  type: 'text' | 'pixel'
}

export interface LayerBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Project {
  id: string
  status: string
  psdFilename?: string
  psdFileSize?: number
  psdCompatible?: boolean
  incompatibilityReason?: string
  psdWidth?: number
  psdHeight?: number
  psdLayers?: PsdLayer[]
  defaultCaptionStyle?: CaptionStyle
  imageLayerBounds?: LayerBounds | null
  templateBgPng?: string | null
  templateFgPng?: string | null
  articleData?: ArticleData
}

// ─── Preview result ───────────────────────────────────────────────────────────
export interface PreviewResult {
  previewPng: string        // base64 PNG with caption baked
  basePreviewPng?: string    // base64 PNG without caption (clean background for live CSS caption)
  width: number
  height: number
}

// ─── Upload result ────────────────────────────────────────────────────────────
export interface UploadedImage {
  url: string           // /api/projects/:id/uploads/:filename
  filename: string
  mimeType: string
  size: number
}
