import { useCallback, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import clsx from 'clsx'

interface UploadZoneProps {
  onFile: (file: File) => void
  uploading: boolean
  uploadedName?: string | null
  uploadedSize?: number | null
  onReplace?: () => void
}

export function UploadZone({ onFile, uploading, uploadedName, uploadedSize, onReplace }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.toLowerCase().endsWith('.psd')) onFile(file)
    },
    [onFile]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (uploadedName) {
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-800/60 rounded-xl border border-gray-700 animate-fade-in">
        <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate">{uploadedName}</p>
          {uploadedSize && <p className="text-xs text-gray-500">{formatSize(uploadedSize)}</p>}
        </div>
        <button onClick={onReplace} className="btn-ghost text-sm px-3 py-1.5">
          Replace
        </button>
      </div>
    )
  }

  return (
    <label
      className={clsx(
        'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150',
        dragging
          ? 'border-brand-500 bg-brand-500/10'
          : 'border-gray-700 hover:border-gray-600 bg-gray-800/30 hover:bg-gray-800/60'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" accept=".psd" className="hidden" onChange={handleChange} />
      <div className={clsx(
        'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
        dragging ? 'bg-brand-500/20' : 'bg-gray-800'
      )}>
        <Upload className={clsx('w-6 h-6', dragging ? 'text-brand-400' : 'text-gray-500')} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-300">
          {uploading ? 'Uploading…' : 'Drop your PSD here'}
        </p>
        <p className="text-xs text-gray-600 mt-1">or click to browse · .psd only</p>
      </div>
    </label>
  )
}
