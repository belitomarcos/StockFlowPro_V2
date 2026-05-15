import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let html5QrCode: Html5Qrcode;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        // Try to start with environment camera
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            (decodedText) => {
              onScan(decodedText);
              html5QrCode.stop().catch(console.error);
            },
            () => { /* ignore per-frame errors */ }
          );
        } catch (initialError) {
          console.warn("Failed with environment camera, trying any camera:", initialError);
          // Fallback: Use any available camera
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            await html5QrCode.start(
              devices[0].id,
              {
                fps: 10,
                qrbox: { width: 250, height: 150 },
              },
              (decodedText) => {
                onScan(decodedText);
                html5QrCode.stop().catch(console.error);
              },
              () => { /* ignore per-frame errors */ }
            );
          } else {
            throw new Error("Nenhuma câmera encontrada no dispositivo.");
          }
        }
      } catch (err: any) {
        console.error("Failed to start scanner", err);
        setError(err.message || "Não foi possível acessar a câmera.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-[24px] max-w-sm w-full relative shadow-2xl overflow-hidden">
        <button 
          onClick={() => {
            if (scannerRef.current?.isScanning) {
              scannerRef.current.stop().catch(console.error).finally(onClose);
            } else {
              onClose();
            }
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-20"
        >
          <X size={24} />
        </button>
        
        <div className="mb-6">
          <h3 className="text-white text-center font-bold text-lg font-outfit">Escaneamento de Ativo</h3>
          <p className="text-slate-400 text-center text-xs mt-1">Aponte para o código de barras ou QR Code</p>
        </div>

        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-950 border border-[#1e293b]">
          <div id="reader" className="w-full h-full"></div>
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-950/80">
              <CameraOff className="text-rose-500 mb-4" size={48} />
              <p className="text-white font-bold mb-2">Erro na Câmera</p>
              <p className="text-slate-400 text-xs">{error}</p>
              <button 
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-[#1e293b] text-white rounded-full text-xs font-bold hover:bg-slate-800 transition-all"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-center">
           <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
