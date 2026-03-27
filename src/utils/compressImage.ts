// COMPRESS IMAGE — Resizes and converts images to JPEG before sending to AI.
//
// Why: Full-resolution photos (especially from phones) are 3-8 MB. The AI only
// needs to read text on labels, so we downscale to max 1280px and re-encode as
// JPEG at 0.7 quality. This typically shrinks images by 60-80%, saving API quota.
//
// HEIC handling: iPhones shoot HEIC by default. Safari can render it natively,
// but Chrome/Firefox cannot. We use `heic-decode` (backed by libheif-js 1.17+)
// to decode HEIC to raw pixels, then render via canvas.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

function isHeic(file: File): boolean {
  return file.type === "image/heic" || file.type === "image/heif"
    || file.name.toLowerCase().endsWith(".heic")
    || file.name.toLowerCase().endsWith(".heif");
}

/**
 * Decode a HEIC/HEIF file to an ImageBitmap via heic-decode.
 * heic-decode returns raw RGBA pixel data, which we draw onto a canvas
 * and convert to an ImageBitmap for the rest of the pipeline.
 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  // Dynamic import to handle CJS/ESM interop — heic-decode uses module.exports
  const mod = await import("heic-decode");
  const decode = typeof mod.default === "function" ? mod.default : mod;

  // heic-decode expects a Uint8Array (it indexes bytes directly), not an ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { width, height, data } = await (decode as (opts: { buffer: Uint8Array }) =>
    Promise<{ width: number; height: number; data: Uint8ClampedArray }>)({ buffer });

  // data is RGBA pixels — wrap in ImageData and draw to canvas
  const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  return createImageBitmap(canvas);
}

/**
 * Compress and convert an image file to JPEG at reduced resolution.
 * Accepts JPEG, PNG, WebP, HEIC/HEIF, and other browser-supported formats.
 */
export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;

  if (isHeic(file)) {
    // HEIC: decode with heic-decode (works in all browsers)
    // Falls back to native createImageBitmap for Safari which supports HEIC natively
    try {
      bitmap = await decodeHeic(file);
    } catch (heicErr) {
      console.warn("heic-decode failed, trying native rendering:", heicErr);
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        throw new Error(
          "This HEIC image could not be converted. Please open it in Photos and export as JPEG, then try again."
        );
      }
    }
  } else {
    // Standard formats (JPEG, PNG, WebP) — browser handles natively
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("This image format could not be read by your browser.");
    }
  }

  const { width, height } = bitmap;

  // Calculate new dimensions (preserve aspect ratio, cap at MAX_DIMENSION)
  let newWidth = width;
  let newHeight = height;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      newWidth = MAX_DIMENSION;
      newHeight = Math.round(height * (MAX_DIMENSION / width));
    } else {
      newHeight = MAX_DIMENSION;
      newWidth = Math.round(width * (MAX_DIMENSION / height));
    }
  }

  // Draw to canvas and export as JPEG
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const jpegBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });

  // Build a new File object so downstream code can use .name and .type
  const compressedName = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([jpegBlob], compressedName, { type: "image/jpeg" });
}
