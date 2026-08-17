// Downscales an image file client-side before upload, so a full-res phone
// photo doesn't get shipped over patchy course wifi for a tiny avatar.
export function resizeImageFile(file, { maxDim = 512, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width))
        width = maxDim
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height))
        height = maxDim
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Could not process image'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }

    img.src = url
  })
}
