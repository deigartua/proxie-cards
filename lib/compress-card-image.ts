/**
 * Client-side compression/crop utility for user-uploaded custom card images.
 *
 * Takes an arbitrary image file and produces a JPEG blob cropped (cover-fit,
 * centered) to the Magic card aspect ratio (63:88mm) and resized to the same
 * resolution used for print output (see CARD_W_MM/CARD_H_MM/PDF_DPI in
 * lib/generate-pdf.ts) — there is no reason to upload or store a heavier
 * image than what will ever actually be printed.
 */

const CARD_W_MM = 63
const CARD_H_MM = 88
const PRINT_DPI = 300

const OUTPUT_W_PX = Math.round((CARD_W_MM / 25.4) * PRINT_DPI) // ~744px
const OUTPUT_H_PX = Math.round((CARD_H_MM / 25.4) * PRINT_DPI) // ~1039px

const JPEG_QUALITY = 0.85

/** Reject original files above this size before ever touching a canvas. */
export const MAX_ORIGINAL_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export interface CompressCardImageResult {
  blob: Blob
  width: number
  height: number
}

/**
 * Validates that a File is an acceptable image and within the size limit.
 * Returns an error message (in Spanish, user-facing) or null if valid.
 */
export function validateCardImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" no es una imagen valida`
  }
  if (file.size > MAX_ORIGINAL_FILE_SIZE_BYTES) {
    return `"${file.name}" pesa demasiado (maximo 10MB)`
  }
  return null
}

/**
 * Loads a File into an HTMLImageElement.
 */
function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("No se pudo leer la imagen"))
    }
    img.src = url
  })
}

/**
 * Compresses and center-crops (cover-fit) an image file down to the card's
 * print resolution, returning a JPEG blob ready to upload.
 */
export async function compressCardImage(file: File): Promise<CompressCardImageResult> {
  const validationError = validateCardImageFile(file)
  if (validationError) throw new Error(validationError)

  const img = await loadImageFile(file)

  const canvas = document.createElement("canvas")
  canvas.width = OUTPUT_W_PX
  canvas.height = OUTPUT_H_PX
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo procesar la imagen")

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Cover-fit: scale so the image fully covers the target box, then crop
  // the overflow by centering it.
  const srcRatio = img.width / img.height
  const dstRatio = OUTPUT_W_PX / OUTPUT_H_PX

  let sx: number, sy: number, sw: number, sh: number
  if (srcRatio > dstRatio) {
    // Source is wider than target — crop left/right
    sh = img.height
    sw = sh * dstRatio
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    // Source is taller than target — crop top/bottom
    sw = img.width
    sh = sw / dstRatio
    sx = 0
    sy = (img.height - sh) / 2
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_W_PX, OUTPUT_H_PX)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  )
  if (!blob) throw new Error("No se pudo comprimir la imagen")

  return { blob, width: OUTPUT_W_PX, height: OUTPUT_H_PX }
}
