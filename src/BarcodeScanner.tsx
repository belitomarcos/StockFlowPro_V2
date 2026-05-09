import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 }, // For barcodes usually rects are better
          },
          (decodedText) => {
            onScan(decodedText);
            html5QrCode.stop().catch(console.error);
          },
          (errorMessage) => {
            // ignore scan errors
          }
        );
      } catch (err) {
        console.error("Failed to start scanner", err);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      } else if (scannerRef.current) {
         // handle case where sometimes object exists and we need to clean up
         try {
             scannerRef.current.clear();
         } catch(e) {}
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-4 rounded-xl max-w-sm w-full relative">
        <button 
          onClick={() => {
            if (scannerRef.current?.isScanning) {
              scannerRef.current.stop().catch(console.error);
            }
            onClose();
          }}
          className="absolute -top-3 -right-3 text-white bg-rose-500 p-2 rounded-full hover:bg-rose-600 z-10 w-8 h-8 flex items-center justify-center font-bold"
        >
          X
        </button>
        <h3 className="text-white text-center font-medium mb-4">Aponte a câmera para o código</h3>
        <div id="reader" className="w-full rounded-lg overflow-hidden bg-black"></div>
      </div>
    </div>
  );
}
