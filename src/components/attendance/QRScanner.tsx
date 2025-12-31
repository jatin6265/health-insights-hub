import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, CheckCircle, XCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (token: string, sessionId: string) => Promise<{ success: boolean; message: string }>;
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    try {
      setError(null);
      setScanResult(null);

      if (!containerRef.current) return;

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // Parse the URL to extract token and session
          try {
            const url = new URL(decodedText);
            const token = url.searchParams.get('token');
            const sessionId = url.searchParams.get('session');

            if (token && sessionId) {
              await scanner.stop();
              setIsScanning(false);
              
              const result = await onScan(token, sessionId);
              setScanResult(result);
            }
          } catch {
            // Not a valid URL, try parsing as direct token
            console.log('Invalid QR format');
          }
        },
        () => {
          // Ignore scan errors (no QR found)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Scan Attendance QR</h2>
          <p className="text-sm text-muted-foreground">
            Point your camera at the QR code displayed by your trainer
          </p>
        </div>

        <div
          id="qr-reader"
          ref={containerRef}
          className="w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden"
        >
          {!isScanning && !scanResult && (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-16 h-16 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg text-destructive">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {scanResult && (
          <div
            className={`flex items-center gap-2 p-4 rounded-lg ${
              scanResult.success
                ? 'bg-green-500/10 text-green-700'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {scanResult.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{scanResult.message}</p>
          </div>
        )}

        <div className="flex justify-center gap-4">
          {!isScanning ? (
            <Button onClick={startScanning} className="w-full max-w-xs">
              <Camera className="w-4 h-4 mr-2" />
              Start Scanning
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="w-full max-w-xs">
              <CameraOff className="w-4 h-4 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>

        {scanResult?.success && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setScanResult(null);
              startScanning();
            }}
          >
            Scan Another
          </Button>
        )}
      </div>
    </Card>
  );
}
