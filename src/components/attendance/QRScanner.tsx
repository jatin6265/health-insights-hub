import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, CheckCircle, XCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (token: string, sessionId: string) => Promise<{ success: boolean; message: string }>;
  isActive?: boolean;
}

export function QRScanner({ onScan, isActive = true }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  const scannerContainerId = useRef(`qr-reader-${Math.random().toString(36).substr(2, 9)}`);

  const cleanupScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch (err) {
      // Scanner may already be stopped
      console.debug('Scanner stop:', err);
    }

    try {
      await scanner.clear();
    } catch (err) {
      // Ignore clear errors
      console.debug('Scanner clear:', err);
    }

    scannerRef.current = null;
  }, []);

  const stopScanning = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    await cleanupScanner();

    if (isMountedRef.current) {
      setIsScanning(false);
    }
    isProcessingRef.current = false;
  }, [cleanupScanner]);

  const startScanning = useCallback(async () => {
    if (isProcessingRef.current || !isActive) return;
    isProcessingRef.current = true;

    try {
      setError(null);
      setScanResult(null);

      // Ensure previous scanner is fully stopped
      await cleanupScanner();

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 150));

      if (!isMountedRef.current || !isActive) {
        isProcessingRef.current = false;
        return;
      }

      const container = document.getElementById(scannerContainerId.current);
      if (!container) {
        isProcessingRef.current = false;
        return;
      }

      const scanner = new Html5Qrcode(scannerContainerId.current, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          try {
            const url = new URL(decodedText);
            const token = url.searchParams.get('token');
            const sessionId = url.searchParams.get('session');

            if (token && sessionId) {
              await stopScanning();
              
              if (isMountedRef.current) {
                const result = await onScan(token, sessionId);
                setScanResult(result);
              }
            }
          } catch {
            console.debug('Invalid QR format');
          }
        },
        () => {
          // Ignore scan errors (no QR found)
        }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Error starting scanner:', err);
      if (isMountedRef.current) {
        setError('Failed to access camera. Please ensure camera permissions are granted.');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [onScan, stopScanning, cleanupScanner, isActive]);

  // Cleanup on unmount or when isActive changes
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Synchronous cleanup attempt
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch {}
            }).catch(() => {});
          } else {
            try { scanner.clear(); } catch {}
          }
        } catch {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
    };
  }, []);

  // Stop scanner when becoming inactive
  useEffect(() => {
    if (!isActive && isScanning) {
      stopScanning();
    }
  }, [isActive, isScanning, stopScanning]);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Scan Attendance QR</h2>
          <p className="text-sm text-muted-foreground">
            Point your camera at the QR code displayed by your trainer
          </p>
        </div>

        {/* Important: keep the scanner mount node free of React-managed children.
            html5-qrcode mutates/clears its container; if React also renders children inside,
            React can later attempt to delete nodes that the library already removed.
        */}
        <div className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-lg overflow-hidden">
          <div id={scannerContainerId.current} className="absolute inset-0" />

          {!isScanning && !scanResult && (
            <div className="absolute inset-0 flex items-center justify-center">
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
            <Button onClick={startScanning} className="w-full max-w-xs" disabled={!isActive}>
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
