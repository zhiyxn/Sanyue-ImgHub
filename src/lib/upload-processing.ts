export type LinkFormat = 'url' | 'md' | 'html' | 'ubb'

export function formatUploadedLink(url: string, name: string, format: LinkFormat): string {
  if (format === 'md') return `![${name}](${url})`
  if (format === 'html') return `<img src="${url}" alt="${name}" width="100%">`
  if (format === 'ubb') return `[img]${url}[/img]`
  return url
}

interface ImageProcessingOptions {
  compress: boolean
  thresholdMB: number
  targetMB: number
  convertToWebp: boolean
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法解码图片'))
      image.src = url
    })
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('浏览器无法处理该图片')), type, quality)
  })
}

export async function processImageForUpload(file: File, options: ImageProcessingOptions): Promise<File> {
  const unsupported = /image\/(gif|svg\+xml)/i.test(file.type)
  const needsCompression = options.compress && file.size > Math.max(0.1, options.thresholdMB) * 1024 * 1024
  const needsConversion = options.convertToWebp && file.type !== 'image/webp'
  if (!file.type.startsWith('image/') || unsupported || (!needsCompression && !needsConversion)) return file

  const image = await loadImage(file)
  try {
    let width = image.width
    let height = image.height
    const maxDimension = Math.max(width, height)
    if (maxDimension > 4096) {
      const ratio = 4096 / maxDimension
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return file
    const outputType = needsConversion ? 'image/webp' : ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg'
    const targetBytes = Math.max(0.1, Math.min(options.targetMB, options.thresholdMB)) * 1024 * 1024
    let quality = 0.9
    let blob: Blob | undefined

    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width
      canvas.height = height
      context.clearRect(0, 0, width, height)
      context.drawImage(image.source, 0, 0, width, height)
      blob = await canvasBlob(canvas, outputType, quality)
      if (!needsCompression || blob.size <= targetBytes) break
      const ratio = Math.max(0.55, Math.min(0.92, Math.sqrt(targetBytes / blob.size) * 0.96))
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
      quality = Math.max(0.45, quality - 0.08)
    }

    if (!blob || (!needsConversion && blob.size >= file.size)) return file
    const name = needsConversion ? file.name.replace(/\.[^.]+$/, '') + '.webp' : file.name
    return new File([blob], name, { type: outputType, lastModified: file.lastModified })
  } finally {
    image.close?.()
  }
}
