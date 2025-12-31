import { QRCodeSVG } from 'qrcode.react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Clock, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface QRCodeDisplayProps {
  sessionId: string;
  sessionTitle: string;
  qrToken: string | null;
  expiresAt: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function QRCodeDisplay({
  sessionId,
  sessionTitle,
  qrToken,
  expiresAt,
  isOpen,
  onClose,
  onRefresh,
}: QRCodeDisplayProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // Generate the attendance URL with the QR token
  const attendanceUrl = qrToken 
    ? `${window.location.origin}/scan?token=${qrToken}&session=${sessionId}`
    : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Session QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {sessionTitle}
          </p>

          {qrToken ? (
            <>
              <Card className="p-6 bg-white">
                <QRCodeSVG
                  value={attendanceUrl}
                  size={240}
                  level="H"
                  includeMargin
                />
              </Card>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Expires in:</span>
                <span className={`font-medium ${timeRemaining === 'Expired' ? 'text-destructive' : 'text-foreground'}`}>
                  {timeRemaining}
                </span>
              </div>

              <p className="text-xs text-center text-muted-foreground max-w-xs">
                Trainees can scan this QR code to mark their attendance. 
                The code refreshes every session start.
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No active QR code</p>
              <p className="text-sm">Start the session to generate a QR code</p>
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh QR
            </Button>
            <Button className="flex-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
