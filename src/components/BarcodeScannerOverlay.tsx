import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { motion } from "motion/react";

interface Props {
  onResult: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScannerOverlay({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
      if (result) {
        onResult(result.getText());
        (reader as unknown as { reset(): void }).reset();
      }
      void err;
    });

    return () => {
      (reader as unknown as { reset(): void }).reset();
    };
  }, [onResult]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
      }}
    >
      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          style={{
            width: "min(90vw, 400px)",
            height: "min(90vw, 400px)",
            objectFit: "cover",
            borderRadius: "0.75rem",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "3px solid transparent",
            borderRadius: "0.75rem",
            boxShadow: "0 0 0 3px rgba(255,255,255,0.4) inset",
            pointerEvents: "none",
          }}
        />
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", textAlign: "center", marginTop: "0.75rem" }}>
          Point the camera at a barcode
        </p>
      </div>

      <button
        onClick={onClose}
        style={{
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "white",
          padding: "0.6rem 2rem",
          borderRadius: "2rem",
          cursor: "pointer",
          fontSize: "0.95rem",
        }}
      >
        Cancel
      </button>
    </motion.div>
  );
}
