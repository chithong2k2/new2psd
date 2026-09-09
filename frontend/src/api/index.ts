import axios from 'axios'
import type { Project, PreviewResult, ArticleData, CaptionStyle, ImageSlot, UploadedImage } from '../types'

const api = axios.create({ baseURL: '/api' })

export const createProject = async (): Promise<Project> => {
  const { data } = await api.post('/projects')
  return data
}

export const getProject = async (id: string): Promise<Project> => {
  const { data } = await api.get(`/projects/${id}`)
  return data
}

export const uploadPsd = async (id: string, file: File): Promise<Project> => {
  const form = new FormData()
  form.append('psd', file)
  const { data } = await api.post(`/projects/${id}/upload-psd`, form)
  return data
}

/** Upload an image file from disk. Returns a local URL served by the backend. */
export const uploadImage = async (id: string, file: File): Promise<UploadedImage> => {
  const form = new FormData()
  form.append('image', file)
  const { data } = await api.post(`/projects/${id}/upload-image`, form)
  return data
}

/** Fetch an image from a remote URL and store on backend. Returns a local URL. */
export const fetchImageFromUrl = async (id: string, url: string): Promise<UploadedImage> => {
  const { data } = await api.post(`/projects/${id}/upload-image`, { url })
  return data
}

export const analyzeArticle = async (id: string, url: string): Promise<Project> => {
  const { data } = await api.post(`/projects/${id}/analyze-article`, { url })
  return data
}

export const searchRelatedNews = async (
  id: string,
  query?: string
): Promise<{ relatedImages: any[]; foundCount: number }> => {
  const { data } = await api.post(`/projects/${id}/search-related-news`, { query })
  return data
}

export const getArticle = async (id: string): Promise<ArticleData> => {
  const { data } = await api.get(`/projects/${id}/article`)
  return data
}

export const generatePreview = async (
  id: string,
  images: ImageSlot[],
  layout: string,
  caption: CaptionStyle
): Promise<PreviewResult> => {
  const { data } = await api.post(`/projects/${id}/preview`, { images, layout, caption })
  return data
}

export const prepareExport = async (
  id: string,
  images: ImageSlot[],
  layout: string,
  caption: CaptionStyle
): Promise<void> => {
  await api.post(`/projects/${id}/export/prepare`, { images, layout, caption })
}

export const getExportPngUrl  = (id: string) => `/api/projects/${id}/export/png`
export const getExportPsdUrl  = (id: string) => `/api/projects/${id}/export/psd`
export const getProxiedImageUrl = (id: string, url: string) =>
  `/api/projects/${id}/proxy-image?url=${encodeURIComponent(url)}`
