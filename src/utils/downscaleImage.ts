// ═══════════════════════════════════════════════════════════════════════════
// downscaleImage.ts  —  En4tainment / En410
// Shrinks an image in the browser before upload.
//
// WHY: measured 2026-11-16 on a Galaxy A51 at default 12MP, a photo of an ID
// card is 2.40 MB — over the 2 MiB client cap on the document path, so the
// talent was rejected on the MANDATORY KYC step for doing nothing unusual.
//
// Downscaling protects the free R2 tier BETTER than a cap does: a cap only
// limits the worst case, this reduces the typical one (~2.4 MB -> ~0.5 MB).
//
// Secondary benefit: the output is generated from pixels alone, so EXIF,
// trailing payloads and polyglot files do not survive the round trip. That is
// a bonus, NOT the defence — upload-document's magic-byte check on the actual
// bytes remains the security boundary, and files that pass through unchanged
// (PDFs, already-small images) are not sanitised at all.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_EDGE = 2000  // long edge in px. NIC text stays legible well below this.
const QUALITY  = 0.85

/**
 * Returns a downscaled JPEG, or the original file unchanged when downscaling
 * is impossible, unnecessary, or counterproductive.
 *
 * Never throws: every failure path returns the original, so the caller's
 * existing validation and the server's checks still decide its fate.
 */
export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<File> {
  // PDFs cannot go through a canvas.
  if (!file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    // imageOrientation applies the EXIF rotation during decode. Without it a
    // portrait phone photo arrives sideways, and a sideways NIC fails review.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  const longest = Math.max(bitmap.width, bitmap.height)

  // Already small enough — re-encoding would only lose quality.
  if (longest <= maxEdge) {
    bitmap.close()
    return file
  }

  const scale = maxEdge / longest
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) return file

  // Re-encoding can enlarge a small PNG. Never hand back something bigger.
  if (blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
}