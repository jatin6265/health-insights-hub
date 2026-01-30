import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Check,
  X,
  Loader2,
  Users,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';

interface JoinRequest {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  requested_at: string;
  trainee_name: string | null;
  trainee_email: string | null;
  session_title: string;
  session_date: string;
  session_time: string;
}

export function TrainerJoinRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPendingRequests();
      subscribeToRequests();
    }
  }, [user]);

  const subscribeToRequests = () => {
    if (!user) return;

    const channel = supabase
      .channel('trainer-join-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'join_requests',
        },
        () => {
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchPendingRequests = async () => {
    if (!user) return;

    try {
      // Get sessions where current user is trainer
      const { data: trainerSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, title, scheduled_date, start_time')
        .eq('trainer_id', user.id)
        .in('status', ['scheduled', 'active']);

      if (sessionsError) throw sessionsError;

      if (!trainerSessions || trainerSessions.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const sessionIds = trainerSessions.map(s => s.id);
      const sessionMap = new Map(trainerSessions.map(s => [s.id, s]));

      // Get pending join requests for these sessions
      const { data: pendingRequests, error: requestsError } = await supabase
        .from('join_requests')
        .select('*')
        .in('session_id', sessionIds)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (!pendingRequests || pendingRequests.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Get trainee profiles
      const userIds = pendingRequests.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const mapped: JoinRequest[] = pendingRequests.map(r => {
        const session = sessionMap.get(r.session_id);
        const profile = profileMap.get(r.user_id);
        return {
          id: r.id,
          session_id: r.session_id,
          user_id: r.user_id,
          status: r.status,
          requested_at: r.requested_at,
          trainee_name: profile?.full_name || null,
          trainee_email: profile?.email || null,
          session_title: session?.title || 'Unknown Session',
          session_date: session?.scheduled_date || '',
          session_time: session?.start_time || '',
        };
      });

      setRequests(mapped);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load join requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    setProcessing(request.id);
    try {
      // Update join request status
      const { error: updateError } = await supabase
        .from('join_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Mark attendance as present
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert({
          session_id: request.session_id,
          user_id: request.user_id,
          status: 'present',
          join_time: new Date().toISOString(),
        }, {
          onConflict: 'session_id,user_id',
        });

      if (attendanceError) {
        // If upsert fails, try insert
        await supabase
          .from('attendance')
          .insert({
            session_id: request.session_id,
            user_id: request.user_id,
            status: 'present',
            join_time: new Date().toISOString(),
          });
      }

      toast.success(`Approved join request for ${request.trainee_name || 'trainee'}`);
      fetchPendingRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: JoinRequest) => {
    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from('join_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success(`Rejected join request`);
      fetchPendingRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Join Requests</h2>
        </div>
        {requests.length > 0 && (
          <Badge variant="secondary">{requests.length} pending</Badge>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No pending join requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-4 border rounded-lg bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">
                    {request.trainee_name || 'Unknown Trainee'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {request.trainee_email}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">{request.session_title}</span>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(request.session_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {request.session_time}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requested at {formatTime(request.requested_at)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(request)}
                    disabled={processing === request.id}
                  >
                    {processing === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(request)}
                    disabled={processing === request.id}
                  >
                    {processing === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
