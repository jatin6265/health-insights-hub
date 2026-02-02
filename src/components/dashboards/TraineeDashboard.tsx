import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Scan,
  MapPin,
  UserCircle,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { Session, SessionStatus, Attendance, AttendanceStatus } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';
import { QRScanner } from '@/components/attendance/QRScanner';
import { 
  DashboardStatsSkeleton, 
  DashboardSessionsSkeleton, 
  DashboardScanCardSkeleton 
} from '@/components/ui/dashboard-skeleton';
import { SelfEnrollment } from '@/components/training/SelfEnrollment';
import { TraineeSessionJoin } from '@/components/training/TraineeSessionJoin';

// Refresh callback type
type RefreshCallback = () => void;

interface SessionWithAttendance extends Session {
  training?: {
    title: string;
  };
  attendance?: Attendance;
}

export function TraineeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    absent: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [isScannerReady, setIsScannerReady] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTraineeData();
    }
  }, [user]);

  // Delay scanner rendering until dialog animation completes
  useEffect(() => {
    if (showScanner) {
      const timer = setTimeout(() => {
        setIsScannerReady(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsScannerReady(false);
    }
  }, [showScanner]);

  const fetchTraineeData = async () => {
    if (!user) return;

    try {
      // Fetch sessions assigned to this trainee
      const { data: participations, error: partError } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id);

      if (partError) {
        console.error('Error fetching participations:', partError);
        throw partError;
      }

      const sessionIds = participations?.map(p => p.session_id) || [];

      if (sessionIds.length === 0) {
        setSessions([]);
        setStats({
          totalSessions: 0,
          attended: 0,
          absent: 0,
          attendanceRate: 100,
        });
        setLoading(false);
        return;
      }

      // Fetch session details with training info
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .in('id', sessionIds)
        .order('scheduled_date', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
        throw sessionsError;
      }

      // Fetch attendance records for this user
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionIds);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
      }

      const attendanceMap = new Map(
        attendanceData?.map(a => [a.session_id, a]) || []
      );

      const sessionsWithAttendance: SessionWithAttendance[] = (sessionsData || []).map(s => ({
        ...s,
        status: s.status as SessionStatus,
        late_threshold_minutes: s.late_threshold_minutes ?? 15,
        training: s.trainings as { title: string } | undefined,
        attendance: attendanceMap.get(s.id) as Attendance | undefined,
      }));

      setSessions(sessionsWithAttendance);

      // Calculate stats based on completed sessions only
      const completedSessions = sessionsWithAttendance.filter(s => s.status === 'completed');
      const attended = completedSessions.filter(s => 
        s.attendance?.status === 'present' || s.attendance?.status === 'late'
      ).length;
      // Count absent as: explicit 'absent' status OR no attendance record for completed session
      const absent = completedSessions.filter(s => 
        s.attendance?.status === 'absent' || !s.attendance
      ).length;

      setStats({
        totalSessions: sessionsWithAttendance.length,
        attended,
        absent,
        attendanceRate: completedSessions.length > 0 ? Math.round((attended / completedSessions.length) * 100) : 100,
      });
    } catch (error) {
      console.error('Error fetching trainee data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseScanner = useCallback(() => {
    setIsScannerReady(false);
    // Small delay to allow scanner cleanup before dialog closes
    setTimeout(() => {
      setShowScanner(false);
    }, 100);
  }, []);

  const handleScan = async (token: string, sessionId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession?.access_token) {
        return { success: false, message: 'Please log in to mark attendance' };
      }

      const response = await supabase.functions.invoke('mark-attendance', {
        body: { token, sessionId },
      });

      if (response.error) {
        return { success: false, message: response.error.message || 'Failed to mark attendance' };
      }

      const result = response.data;
      
      if (result.success) {
        toast.success(result.message);
        fetchTraineeData(); // Refresh data
        handleCloseScanner();
      }
      
      return result;
    } catch (error) {
      console.error('Error marking attendance:', error);
      return { success: false, message: 'Failed to mark attendance' };
    }
  };

  const getAttendanceBadge = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Present
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-amber-500">
            <Clock className="w-3 h-3 mr-1" />
            Late
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Absent
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getSessionStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 animate-pulse">Live Now</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Upcoming</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button variant="outline" disabled>
            <UserCircle className="w-4 h-4 mr-2" />
            My Profile
          </Button>
        </div>
        <DashboardScanCardSkeleton />
        <DashboardStatsSkeleton />
        <DashboardSessionsSkeleton />
        <DashboardSessionsSkeleton />
      </div>
    );
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const pastSessions = sessions.filter(s => s.status === 'completed');

  return (
    <Tabs defaultValue="dashboard" className="space-y-6">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="dashboard">My Dashboard</TabsTrigger>
          <TabsTrigger value="enroll" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Browse Sessions
          </TabsTrigger>
        </TabsList>
        <Button variant="outline" onClick={() => navigate('/profile')}>
          <UserCircle className="w-4 h-4 mr-2" />
          My Profile
        </Button>
      </div>

      <TabsContent value="dashboard" className="space-y-6">
      {/* My Assigned Sessions - Join Request & QR Scan */}
      <TraineeSessionJoin 
        onScanQR={() => setShowScanner(true)} 
        onRefreshData={fetchTraineeData}
      />

      {/* Upcoming Sessions */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Upcoming Sessions</h2>
        </div>
        {upcomingSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No upcoming sessions
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground">{session.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {session.training?.title} • {session.scheduled_date} • {session.start_time}
                  </p>
                  {session.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {session.location}
                    </p>
                  )}
                </div>
                {getSessionStatusBadge(session.status)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Attendance History */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Attendance History</h2>
        </div>
        {pastSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No attendance history yet
          </div>
        ) : (
          <div className="space-y-3">
            {pastSessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground">{session.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {session.training?.title} • {session.scheduled_date}
                  </p>
                </div>
                {getAttendanceBadge(session.attendance?.status as AttendanceStatus)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={(open) => {
        if (!open) {
          handleCloseScanner();
        } else {
          setShowScanner(true);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Attendance QR</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code to mark your attendance
            </DialogDescription>
          </DialogHeader>
          {isScannerReady && <QRScanner onScan={handleScan} isActive={isScannerReady} />}
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="enroll">
        <SelfEnrollment />
      </TabsContent>
    </Tabs>
  );
}
