import { Download, Loader2, ImageIcon, RefreshCw } from 'lucide-react'

interface LivePreviewProps {
  previewBase64: string | null
  loading: boolean
  projectId: string | null
  width?: number
  height?: number
  onRefresh?: () => void
}

export function LivePreview({ previewBase64, loading, projectId, width, height, onRefresh }: LivePreviewProps) {
  const aspectRatio = width && height ? `${width} / ${height}` : '16 / 9'

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Preview area */}
      <div
        className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden w-full"
        style={{ aspectRatio }}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
            <p className="text-sm text-gray-500">Rendering preview…</p>
            <p className="text-xs text-gray-700">Processing PSD layers</p>
          </div>
        ) : previewBase64 ? (
          <>
            <img
              src={`data:image/png;base64,${previewBase64}`}
              alt="PSD Preview"
              className="w-full h-full object-contain animate-fade-in"
            />
            {/* Refresh button overlay */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-lg text-gray-300 transition-colors"
                title="Regenerate preview"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-700">
            <ImageIcon className="w-12 h-12" />
            <div className="text-center">
              <p className="text-sm font-medium">Live Preview</p>
              <p className="text-xs mt-1">Upload PSD → Paste URL → Choose image</p>
            </div>
          </div>
        )}
      </div>

      {/* Dimension info */}
      {width && height && (
        <p className="text-center text-xs text-gray-600">
          {width} × {height} px · PNG preview
        </p>
      )}

      {/* Export buttons */}
      {previewBase64 && projectId && (
        <div className="grid grid-cols-2 gap-3 animate-slide-up">
          <a
            href={`/api/projects/${projectId}/export/png`}
            download="news2psd-export.png"
            className="btn-primary justify-center"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </a>
          <a
            href={`/api/projects/${projectId}/export/psd`}
            download="news2psd-modified.psd"
            className="btn-secondary justify-center"
          >
            <Download className="w-4 h-4" />
            Download PSD
          </a>
        </div>
      )}
    </div>
  )
}
