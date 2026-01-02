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
import { Clock, RefreshCw, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { format } from 'date-fns';

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
  const { attendanceList, loading: attendanceLoading } = useRealtimeAttendance({
    sessionId,
    enabled: isOpen,
  });

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

  const presentCount = attendanceList.filter(a => a.status === 'present').length;
  const lateCount = attendanceList.filter(a => a.status === 'late').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">Session QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Code Section */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {sessionTitle}
            </p>

            {qrToken ? (
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
                  <span className={`font-medium ${timeRemaining === 'Expired' ? 'text-destructive' : 'text-foreground'}`}>
                    {timeRemaining}
                  </span>
                </div>

                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh QR
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No active QR code</p>
                <p className="text-sm">Start the session to generate a QR code</p>
              </div>
            )}
          </div>

          {/* Real-time Attendance Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Live Attendance</h3>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-500">
                  {presentCount} Present
                </Badge>
                <Badge className="bg-amber-500">
                  {lateCount} Late
                </Badge>
              </div>
            </div>

            <ScrollArea className="h-[280px] border rounded-lg p-2">
              {attendanceLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading...
                </div>
              ) : attendanceList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No attendance recorded yet</p>
                  <p className="text-xs">Waiting for participants...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceList.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {record.status === 'present' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : record.status === 'late' ? (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {record.user_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={record.status === 'present' ? 'default' : 'secondary'}
                          className={record.status === 'present' ? 'bg-green-500' : record.status === 'late' ? 'bg-amber-500' : ''}
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
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
