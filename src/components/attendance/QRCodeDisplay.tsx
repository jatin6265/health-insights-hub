import { QRCodeSVG } from 'qrcode.react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  RefreshCw,
  Users,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { format } from 'date-fns';

interface QRCodeDisplayProps {
  sessionId: string;
  sessionTitle: string;
  qrToken: string | null;
  expiresAt: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
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
  const [timeRemaining, setTimeRemaining] = useState('');
  const { attendanceList, loading } = useRealtimeAttendance({
    sessionId,
    enabled: isOpen,
  });

  /* -------------------- Expiry handling -------------------- */
  const isExpired = useMemo(() => {
    if (!expiresAt) return true;
    return new Date(expiresAt).getTime() <= Date.now();
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining('Expired');
      return;
    }

    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setTimeRemaining(`${h}h ${m}m ${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  /* -------------------- QR URL -------------------- */
  const attendanceUrl =
    qrToken && !isExpired
      ? `${window.location.origin}/scan?token=${qrToken}&session=${sessionId}`
      : '';

  const presentCount = attendanceList.filter(a => a.status === 'present').length;
  const lateCount = attendanceList.filter(a => a.status === 'late').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">Session QR Code</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* -------------------- QR SECTION -------------------- */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {sessionTitle}
            </p>

            {qrToken && !isExpired ? (
              <>
                <Card className="p-6 bg-white">
                  <QRCodeSVG
                    value={attendanceUrl}
                    size={200}
                    level="H"
                    includeMargin
                  />
                </Card>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Expires in:</span>
                  <span className="font-medium text-foreground">
                    {timeRemaining}
                  </span>
                </div>

                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh QR
                </Button>
              </>
            ) : (
              <div className="text-center py-8 space-y-2 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
                <p className="font-medium text-destructive">
                  QR Code Expired
                </p>
                <p className="text-sm">
                  Please refresh the QR to continue attendance.
                </p>
                <Button size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New QR
                </Button>
              </div>
            )}
          </div>

          {/* -------------------- LIVE ATTENDANCE -------------------- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Live Attendance</h3>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-500">{presentCount} Present</Badge>
                <Badge className="bg-amber-500">{lateCount} Late</Badge>
              </div>
            </div>

            <ScrollArea className="h-[280px] border rounded-lg p-2">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading...
                </div>
              ) : attendanceList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No attendance yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceList.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {record.status === 'present' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium">
                          {record.user_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            record.status === 'present'
                              ? 'bg-green-500'
                              : 'bg-amber-500'
                          }
                        >
                          {record.status}
                        </Badge>
                        {record.join_time && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.join_time), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
