// Cross-platform photo capture for the photo-avatar flow.
//
// On iOS (Capacitor native): uses @capacitor/camera Camera.getPhoto() —
// opens the native camera UI, returns a base64 data URL.
//
// On web / Android: opens a hidden file input with `capture="user"` which
// on mobile browsers triggers the front camera; on desktop falls back to
// a file picker. Returns a base64 data URL.
//
// Caller is responsible for any parental-gate / consent flow before
// calling capturePhoto(). The returned image is intended to be sent
// straight to the cartoonify endpoint and discarded; nothing here
// persists the photo.
import { useCallback, useRef } from 'react'
import { Capacitor } from '@capacitor/core'

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

// Resize an image data URL to a max dimension on a <canvas>, returns a new
// data URL. Keeps the request body to /api/generate-avatar small —
// FLUX Kontext only needs ~512px source for a 512px output.
function resizeDataUrl(dataUrl, maxDim = 768, mimeType = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL(mimeType, quality))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function usePhotoCapture() {
  const fileInputRef = useRef(null)

  const captureNative = useCallback(async () => {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      width: 768,
      height: 768,
    })
    if (!photo?.dataUrl) throw new Error('No photo captured')
    return photo.dataUrl
  }, [])

  const captureWeb = useCallback(() => {
    return new Promise((resolve, reject) => {
      let input = fileInputRef.current
      if (!input) {
        input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.capture = 'user' // prefer front camera on mobile (selfie)
        input.style.display = 'none'
        document.body.appendChild(input)
        fileInputRef.current = input
      }

      const onChange = async () => {
        input.removeEventListener('change', onChange)
        const file = input.files?.[0]
        input.value = ''
        if (!file) return reject(new Error('No file selected'))
        try {
          const raw = await fileToDataUrl(file)
          const sized = await resizeDataUrl(raw, 768)
          resolve(sized)
        } catch (e) {
          reject(e)
        }
      }
      input.addEventListener('change', onChange, { once: true })
      input.click()
    })
  }, [])

  const capturePhoto = useCallback(async () => {
    return isNativeIos ? captureNative() : captureWeb()
  }, [captureNative, captureWeb])

  return { capturePhoto, isNativeIos }
}
