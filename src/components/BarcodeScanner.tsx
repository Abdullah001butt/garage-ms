"use client";

import { useEffect, useRef, useState } from "react";

export function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const containerId = useRef(`scanner-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!isActive) return;
      scanner = new Html5Qrcode(containerId.current);
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            onScan(decodedText);
          },
          undefined
        );
      } catch {
        if (isActive) setError("Could not access camera. Check permissions and try again.");
      }
    })();

    return () => {
      isActive = false;
      if (scanner) {
        scanner.stop().then(() => scanner!.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Scan Barcode / QR Code</p>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div id={containerId.current} className="w-full overflow-hidden rounded-lg" />
        )}
      </div>
    </div>
  );
}
