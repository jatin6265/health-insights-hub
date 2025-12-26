import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Scan,
} from 'lucide-react';
import { toast } from 'sonner';
import { Session, SessionStatus, Attendance, AttendanceStatus } from '@/types/auth';
import { useAuth } from '@/hooks/useAuth';

interface SessionWithAttendance extends Session {
  training?: {
    title: string;
  };
  attendance?: Attendance;
}

export function TraineeDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    attended: 0,
    absent: 0,
    attendanceRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTraineeData();
    }
  }, [user]);

  const fetchTraineeData = async () => {
    if (!user) return;

    try {
      // Fetch sessions assigned to this trainee
      const { data: participations, error: partError } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      const sessionIds = participations?.map(p => p.session_id) || [];

      if (sessionIds.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // Fetch session details
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .in('id', sessionIds)
        .order('scheduled_date', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Fetch attendance records
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionIds);

      const attendanceMap = new Map(
        attendanceData?.map(a => [a.session_id, a]) || []
      );

      const sessionsWithAttendance: SessionWithAttendance[] = (sessionsData || []).map(s => ({
        ...s,
        status: s.status as SessionStatus,
        training: s.trainings as { title: string } | undefined,
        attendance: attendanceMap.get(s.id) as Attendance | undefined,
      }));

      setSessions(sessionsWithAttendance);

      // Calculate stats
      const attended = attendanceData?.filter(a => 
        a.status === 'present' || a.status === 'late'
      ).length || 0;
      const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
      const total = sessionsWithAttendance.filter(s => s.status === 'completed').length;

      setStats({
        totalSessions: sessionsWithAttendance.length,
        attended,
        absent,
        attendanceRate: total > 0 ? Math.round((attended / total) * 100) : 100,
      });
    } catch (error) {
      console.error('Error fetching trainee data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const pastSessions = sessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attended</p>
              <p className="text-2xl font-bold text-foreground">{stats.attended}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Absent</p>
              <p className="text-2xl font-bold text-foreground">{stats.absent}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Attendance Rate</p>
              <p className="text-lg font-bold text-foreground">{stats.attendanceRate}%</p>
            </div>
            <Progress value={stats.attendanceRate} className="h-2" />
          </div>
        </Card>
      </div>

      {/* Active Sessions - Mark Attendance */}
      {activeSessions.length > 0 && (
        <Card className="p-6 border-green-500/50 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-lg font-semibold text-foreground">Active Sessions</h2>
          </div>
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-card border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{session.title}</h3>
                    {getSessionStatusBadge(session.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session.training?.title} • {session.location || 'No location'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.attendance ? (
                    getAttendanceBadge(session.attendance.status as AttendanceStatus)
                  ) : (
                    <Button>
                      <Scan className="w-4 h-4 mr-2" />
                      Scan QR
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
    </div>
  );
}
