import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignedSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: string;
  training_title: string;
  trainer_name: string | null;
  join_request_status: 'none' | 'pending' | 'approved' | 'rejected';
  attendance_status: string | null;
}

interface TraineeSessionJoinProps {
  onScanQR?: (sessionId: string) => void;
}

export function TraineeSessionJoin({ onScanQR }: TraineeSessionJoinProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAssignedSessions();
      subscribeToUpdates();
    }
  }, [user]);

  const subscribeToUpdates = () => {
    if (!user) return;

    const channel = supabase
      .channel('join-requests-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAssignedSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchAssignedSessions = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Get sessions user is assigned to
      const { data: participations, error: partError } = await supabase
        .from('session_participants')
        .select(`
          session_id,
          sessions (
            id,
            title,
            description,
            scheduled_date,
            start_time,
            end_time,
            location,
            status,
            trainer_id,
            trainings (title)
          )
        `)
        .eq('user_id', user.id);

      if (partError) throw partError;

      // Filter to upcoming/active sessions
      const upcomingSessions = (participations || [])
        .filter(p => {
          const session = p.sessions as any;
          return session && 
            session.scheduled_date >= today && 
            ['scheduled', 'active'].includes(session.status);
        })
        .map(p => p.sessions as any);

      if (upcomingSessions.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // Get trainer names
      const trainerIds = [...new Set(upcomingSessions.map(s => s.trainer_id).filter(Boolean))];
      const { data: trainers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', trainerIds);
      const trainerMap = new Map(trainers?.map(t => [t.id, t.full_name]) || []);

      // Get join request statuses
      const sessionIds = upcomingSessions.map(s => s.id);
      const { data: joinRequests } = await supabase
        .from('join_requests')
        .select('session_id, status')
        .eq('user_id', user.id)
        .in('session_id', sessionIds);
      const requestMap = new Map(joinRequests?.map(r => [r.session_id, r.status]) || []);

      // Get attendance statuses
      const { data: attendances } = await supabase
        .from('attendance')
        .select('session_id, status')
        .eq('user_id', user.id)
        .in('session_id', sessionIds);
      const attendanceMap = new Map(attendances?.map(a => [a.session_id, a.status]) || []);

      const mapped: AssignedSession[] = upcomingSessions.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        end_time: s.end_time,
        location: s.location,
        status: s.status,
        training_title: s.trainings?.title || 'Training',
        trainer_name: s.trainer_id ? trainerMap.get(s.trainer_id) || null : null,
        join_request_status: (requestMap.get(s.id) as any) || 'none',
        attendance_status: attendanceMap.get(s.id) || null,
      }));

      // Sort by date
      mapped.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
      setSessions(mapped);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async (sessionId: string) => {
    if (!user) return;

    setRequesting(sessionId);
    try {
      const { error } = await supabase
        .from('join_requests')
        .insert({
          session_id: sessionId,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success('Join request sent to trainer');
      fetchAssignedSessions();
    } catch (error: any) {
      console.error('Error sending request:', error);
      if (error.code === '23505') {
        toast.error('You have already requested to join this session');
      } else {
        toast.error('Failed to send join request');
      }
    } finally {
      setRequesting(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (session: AssignedSession) => {
    // If already has attendance marked
    if (session.attendance_status && session.attendance_status !== 'absent') {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          {session.attendance_status === 'present' ? 'Present' : 'Late'}
        </Badge>
      );
    }

    // Check join request status
    switch (session.join_request_status) {
      case 'pending':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">My Assigned Sessions</h2>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No upcoming sessions assigned to you</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="p-4 border rounded-lg bg-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">{session.title}</h3>
                  <p className="text-sm text-muted-foreground">{session.training_title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(session)}
                  {session.status === 'active' && (
                    <Badge className="bg-blue-500">Live</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(session.scheduled_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{session.start_time} - {session.end_time}</span>
                </div>
                {session.location && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="w-4 h-4" />
                    <span>{session.location}</span>
                  </div>
                )}
              </div>

              {session.trainer_name && (
                <p className="text-xs text-muted-foreground mb-3">
                  Trainer: {session.trainer_name}
                </p>
              )}

              {/* Action buttons */}
              {!session.attendance_status || session.attendance_status === 'absent' ? (
                <div className="flex gap-2">
                  {/* QR Scan button for active sessions */}
                  {session.status === 'active' && onScanQR && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onScanQR(session.id)}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Scan QR
                    </Button>
                  )}

                  {/* Join request button */}
                  {session.join_request_status === 'none' && (
                    <Button
                      size="sm"
                      onClick={() => handleRequestJoin(session.id)}
                      disabled={requesting === session.id}
                    >
                      {requesting === session.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Request to Join
                    </Button>
                  )}

                  {session.join_request_status === 'pending' && (
                    <Button size="sm" variant="outline" disabled>
                      <Clock className="w-4 h-4 mr-2" />
                      Awaiting Approval
                    </Button>
                  )}

                  {session.join_request_status === 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestJoin(session.id)}
                      disabled={requesting === session.id}
                    >
                      Request Again
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600">
                  ✓ Attendance already marked
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
