import { useState } from 'react'
import { CheckCircle2, Star, ImageOff } from 'lucide-react'
import clsx from 'clsx'
import type { ArticleImage } from '../types'

interface ImageSelectorProps {
  images: ArticleImage[]
  selectedUrl: string | null
  projectId: string
  onSelect: (image: ArticleImage) => void
}

export function ImageSelector({ images, selectedUrl, projectId, onSelect }: ImageSelectorProps) {
  const [errors, setErrors] = useState<Set<string>>(new Set())

  const proxyUrl = (url: string) =>
    `/api/projects/${projectId}/proxy-image?url=${encodeURIComponent(url)}`

  return (
    <div className="space-y-3 animate-slide-up">
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, i) => {
          const isSelected = img.url === selectedUrl
          const hasError = errors.has(img.url)

          return (
            <button
              key={img.url}
              onClick={() => onSelect(img)}
              className={clsx(
                'relative rounded-xl overflow-hidden border-2 transition-all duration-150 text-left group',
                isSelected
                  ? 'border-brand-500 shadow-lg shadow-brand-500/25'
                  : 'border-gray-700 hover:border-gray-600'
              )}
            >
              {/* Image */}
              <div className="aspect-video bg-gray-800 relative">
                {hasError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-600">
                    <ImageOff className="w-6 h-6" />
                    <span className="text-xs">No preview</span>
                  </div>
                ) : (
                  <img
                    src={proxyUrl(img.url)}
                    alt={img.caption || `Image ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setErrors((prev) => new Set(prev).add(img.url))}
                  />
                )}

                {/* Selected overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-brand-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-brand-400 drop-shadow-lg" />
                  </div>
                )}

                {/* Recommended badge */}
                {img.recommended && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-500/90 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3" />
                    Best
                  </div>
                )}

                {/* Index badge */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded-full">
                  {i + 1}
                </div>
              </div>

              {/* Caption preview */}
              {img.caption && (
                <div className="p-2 bg-gray-800/80 border-t border-gray-700">
                  <p className="text-xs text-gray-400 line-clamp-2">{img.caption}</p>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
