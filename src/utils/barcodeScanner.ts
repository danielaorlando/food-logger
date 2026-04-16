// Barcode scanner service — reads retail barcodes from the iPhone camera.
//
// This only works on iOS (native Capacitor app). On web, every function
// returns null/false so scanner code never runs.
//
// We use @capacitor/barcode-scanner as the bridge between JavaScript and
// Apple's native AVFoundation framework.

import { Capacitor } from "@capacitor/core";
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHint,
} from "@capacitor/barcode-scanner";

// ── PLATFORM CHECK ───────────────────────────────────────────────────────────
// Same pattern as src/utils/healthKit.ts line 16 — check if we're on iOS.

export function isBarcodeScannerAvailable(): boolean {
  return Capacitor.getPlatform() === "ios";
}

// ── SCAN A BARCODE ───────────────────────────────────────────────────────────
// Opens the native camera scanner. Returns the barcode string on success,
// or null if the user cancelled, denied camera permission, or a decode error
// occurred. Callers only need to check "did I get a string?" — they don't
// have to distinguish cancel from error.

export async function scanBarcode(): Promise<string | null> {
  if (!isBarcodeScannerAvailable()) return null;

  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.ALL,
      scanInstructions: "Point the camera at the product barcode",
    });
    return result.ScanResult || null;
  } catch (err) {
    console.warn("[barcodeScanner] scan failed or cancelled:", err);
    return null;
  }
}
