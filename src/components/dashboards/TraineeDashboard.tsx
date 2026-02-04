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
  TrendingUp,
  Timer,
  Activity,
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
  attendance?: Attendance & {
    attendance_type?: 'on_time' | 'late' | 'partial' | null;
  };
}

interface AttendanceStats {
  totalSessions: number;
  attended: number;
  absent: number;
  attendanceRate: number;
  onTime: number;
  late: number;
  partial: number;
  pendingRequests: number;
  lastAttendedSession: string | null;
}

export function TraineeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalSessions: 0,
    attended: 0,
    absent: 0,
    attendanceRate: 0,
    onTime: 0,
    late: 0,
    partial: 0,
    pendingRequests: 0,
    lastAttendedSession: null,
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
          onTime: 0,
          late: 0,
          partial: 0,
          pendingRequests: 0,
          lastAttendedSession: null,
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

      // Fetch pending join requests
      const { data: pendingRequests } = await supabase
        .from('join_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      const attendanceMap = new Map(
        attendanceData?.map(a => [a.session_id, a]) || []
      );

      const sessionsWithAttendance: SessionWithAttendance[] = (sessionsData || []).map(s => ({
        ...s,
        status: s.status as SessionStatus,
        late_threshold_minutes: s.late_threshold_minutes ?? 15,
        training: s.trainings as { title: string } | undefined,
        attendance: attendanceMap.get(s.id) as (Attendance & { attendance_type?: 'on_time' | 'late' | 'partial' | null }) | undefined,
      }));

      setSessions(sessionsWithAttendance);

      // Calculate stats based on completed sessions only
      const completedSessions = sessionsWithAttendance.filter(s => s.status === 'completed');
      
      // Count by attendance type
      let onTimeCount = 0;
      let lateCount = 0;
      let partialCount = 0;
      let attendedCount = 0;
      let lastAttended: string | null = null;

      completedSessions.forEach(s => {
        if (s.attendance?.status === 'present') {
          attendedCount++;
          const type = s.attendance.attendance_type;
          if (type === 'on_time') onTimeCount++;
          else if (type === 'late') lateCount++;
          else if (type === 'partial') partialCount++;
          else onTimeCount++; // Default to on_time if no type specified

          // Track last attended
          if (!lastAttended && s.attendance.join_time) {
            lastAttended = s.scheduled_date;
          }
        }
      });

      const absent = completedSessions.filter(s => 
        s.attendance?.status === 'absent' || !s.attendance
      ).length;

      setStats({
        totalSessions: sessionsWithAttendance.length,
        attended: attendedCount,
        absent,
        attendanceRate: completedSessions.length > 0 ? Math.round((attendedCount / completedSessions.length) * 100) : 100,
        onTime: onTimeCount,
        late: lateCount,
        partial: partialCount,
        pendingRequests: pendingRequests?.length || 0,
        lastAttendedSession: lastAttended,
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

  const getAttendanceBadge = (attendance?: SessionWithAttendance['attendance']) => {
    if (!attendance) {
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }

    if (attendance.status === 'present') {
      const type = attendance.attendance_type;
      if (type === 'late') {
        return (
          <Badge className="bg-amber-500">
            <Clock className="w-3 h-3 mr-1" />
            Late
          </Badge>
        );
      } else if (type === 'partial') {
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      } else {
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            On Time
          </Badge>
        );
      }
    }

    if (attendance.status === 'absent') {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Absent
        </Badge>
      );
    }

    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        {attendance.status}
      </Badge>
    );
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
        {/* Attendance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
                <p className="text-xl font-bold text-foreground">{stats.totalSessions}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attended</p>
                <p className="text-xl font-bold text-foreground">{stats.attended}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
                <p className="text-xl font-bold text-foreground">{stats.attendanceRate}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-xl font-bold text-foreground">{stats.absent}</p>
              </div>
            </div>
          </Card>

          {stats.pendingRequests > 0 && (
            <Card className="p-4 border-amber-500/50 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold text-foreground">{stats.pendingRequests}</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Attendance Type Breakdown */}
        {stats.attended > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-medium text-foreground">Attendance Breakdown</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-600">{stats.onTime}</p>
                <p className="text-xs text-muted-foreground">On Time</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/10">
                <p className="text-2xl font-bold text-orange-600">{stats.partial}</p>
                <p className="text-xs text-muted-foreground">Partial</p>
              </div>
            </div>
          </Card>
        )}

        {/* My Assigned Sessions - Join Request & QR Scan */}
        <TraineeSessionJoin 
          onScanQR={() => setShowScanner(true)} 
          onRefreshData={fetchTraineeData}
        />

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
                  {getAttendanceBadge(session.attendance)}
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
