import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Users,
  QrCode,
  Clock,
  CheckCircle,
  PlayCircle,
  PlusCircle,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Session, SessionStatus } from '@/types/auth';
import { QRCodeDisplay } from '@/components/attendance/QRCodeDisplay';
import { DashboardStatsSkeleton, DashboardSessionsSkeleton } from '@/components/ui/dashboard-skeleton';

interface SessionWithDetails extends Session {
  training?: {
    title: string;
  };
  participant_count?: number;
}

export function TrainerDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    upcomingSessions: 0,
    totalParticipants: 0,
  });
  const [loading, setLoading] = useState(true);
  const [qrSession, setQrSession] = useState<SessionWithDetails | null>(null);

  useEffect(() => {
    if (user) {
      fetchTrainerData();
    }
  }, [user]);

  const fetchTrainerData = async () => {
    if (!user) return;

    try {
      // Fetch trainer's sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .eq('trainer_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Get participant counts for each session
      const sessionIds = sessionsData?.map(s => s.id) || [];
      const { data: participantCounts } = await supabase
        .from('session_participants')
        .select('session_id')
        .in('session_id', sessionIds);

      const countMap = new Map<string, number>();
      participantCounts?.forEach(p => {
        countMap.set(p.session_id, (countMap.get(p.session_id) || 0) + 1);
      });

      const sessionsWithDetails: SessionWithDetails[] = (sessionsData || []).map(s => ({
        ...s,
        status: s.status as SessionStatus,
        late_threshold_minutes: s.late_threshold_minutes ?? 15,
        training: s.trainings as { title: string } | undefined,
        participant_count: countMap.get(s.id) || 0,
      }));

      setSessions(sessionsWithDetails);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalSessions: sessionsWithDetails.length,
        activeSessions: sessionsWithDetails.filter(s => s.status === 'active').length,
        upcomingSessions: sessionsWithDetails.filter(s => s.scheduled_date >= today && s.status === 'scheduled').length,
        totalParticipants: Array.from(countMap.values()).reduce((a, b) => a + b, 0),
      });
    } catch (error) {
      console.error('Error fetching trainer data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      // Generate QR token
      const qrToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4); // QR valid for 4 hours

      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'active',
          qr_token: qrToken,
          qr_expires_at: expiresAt.toISOString(),
          actual_start_time: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session started! QR code is now active.');
      fetchTrainerData();
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Failed to start session');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'completed',
          actual_end_time: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Auto-mark absent for participants without attendance
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId);

      const userIds = participants?.map(p => p.user_id) || [];

      // Get existing attendance records
      const { data: existing } = await supabase
        .from('attendance')
        .select('user_id')
        .eq('session_id', sessionId);

      const attendedIds = new Set(existing?.map(a => a.user_id) || []);
      const absentIds = userIds.filter(id => !attendedIds.has(id));

      // Mark absent
      if (absentIds.length > 0) {
        await supabase.from('attendance').insert(
          absentIds.map(userId => ({
            session_id: sessionId,
            user_id: userId,
            status: 'absent' as const,
          }))
        );
      }

      toast.success('Session ended. Attendance records updated.');
      fetchTrainerData();
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Failed to end session');
    }
  };

  const handleRefreshQR = async (sessionId: string) => {
    try {
      const qrToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4);

      const { error } = await supabase
        .from('sessions')
        .update({
          qr_token: qrToken,
          qr_expires_at: expiresAt.toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('QR code refreshed');
      fetchTrainerData();
    } catch (error) {
      console.error('Error refreshing QR:', error);
      toast.error('Failed to refresh QR code');
    }
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardStatsSkeleton />
        <DashboardSessionsSkeleton />
      </div>
    );
  }

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
              <PlayCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Now</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeSessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold text-foreground">{stats.upcomingSessions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Participants</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalParticipants}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sessions List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Your Sessions</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/reports">
                <BarChart3 className="w-4 h-4 mr-2" />
                Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/training">
                <PlusCircle className="w-4 h-4 mr-2" />
                New Session
              </Link>
            </Button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sessions assigned yet
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{session.title}</h3>
                    {getStatusBadge(session.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session.training?.title} • {session.scheduled_date} • {session.start_time} - {session.end_time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.participant_count} participants • {session.location || 'No location set'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.status === 'scheduled' && (
                    <Button
                      size="sm"
                      onClick={() => handleStartSession(session.id)}
                    >
                      <PlayCircle className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {session.status === 'active' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setQrSession(session)}
                      >
                        <QrCode className="w-4 h-4 mr-1" />
                        View QR
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleEndSession(session.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        End
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR Code Dialog */}
      {qrSession && (
        <QRCodeDisplay
          sessionId={qrSession.id}
          sessionTitle={qrSession.title}
          qrToken={qrSession.qr_token}
          expiresAt={qrSession.qr_expires_at}
          isOpen={!!qrSession}
          onClose={() => setQrSession(null)}
          onRefresh={() => handleRefreshQR(qrSession.id)}
        />
      )}
    </div>
  );
}
