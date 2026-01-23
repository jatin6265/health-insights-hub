import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  UserPlus,
  CheckCircle,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface AvailableSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  training_title: string;
  trainer_name: string | null;
  participant_count: number;
  is_enrolled: boolean;
}

export function SelfEnrollment() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AvailableSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [confirmSession, setConfirmSession] = useState<AvailableSession | null>(null);

  useEffect(() => {
    if (user) {
      fetchAvailableSessions();
    }
  }, [user]);

  const fetchAvailableSessions = async () => {
    if (!user) return;

    try {
      // Get upcoming and active sessions
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          description,
          scheduled_date,
          start_time,
          end_time,
          location,
          trainer_id,
          trainings (title)
        `)
        .in('status', ['scheduled', 'active'])
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Get trainer profiles
      const trainerIds = [...new Set(sessionsData?.map(s => s.trainer_id).filter(Boolean) || [])];
      const { data: trainers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', trainerIds);

      const trainerMap = new Map(trainers?.map(t => [t.id, t.full_name]) || []);

      // Get user's current enrollments
      const { data: enrollments } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id);

      const enrolledIds = new Set(enrollments?.map(e => e.session_id) || []);

      // Get participant counts
      const sessionIds = sessionsData?.map(s => s.id) || [];
      const { data: participantCounts } = await supabase
        .from('session_participants')
        .select('session_id')
        .in('session_id', sessionIds);

      const countMap = new Map<string, number>();
      participantCounts?.forEach(p => {
        countMap.set(p.session_id, (countMap.get(p.session_id) || 0) + 1);
      });

      const mapped: AvailableSession[] = (sessionsData || []).map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        end_time: s.end_time,
        location: s.location,
        training_title: (s.trainings as { title: string })?.title || 'Training',
        trainer_name: s.trainer_id ? trainerMap.get(s.trainer_id) || null : null,
        participant_count: countMap.get(s.id) || 0,
        is_enrolled: enrolledIds.has(s.id),
      }));

      setSessions(mapped);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load available sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (session: AvailableSession) => {
    if (!user) return;

    setEnrolling(session.id);
    try {
      const { error } = await supabase
        .from('session_participants')
        .insert({
          session_id: session.id,
          user_id: user.id,
          assigned_by: user.id, // Self-enrolled
        });

      if (error) throw error;

      toast.success(`Successfully enrolled in "${session.title}"`);
      setConfirmSession(null);
      fetchAvailableSessions(); // Refresh list
    } catch (error: any) {
      console.error('Error enrolling:', error);
      if (error.code === '23505') {
        toast.error('You are already enrolled in this session');
      } else {
        toast.error('Failed to enroll in session');
      }
    } finally {
      setEnrolling(null);
    }
  };

  const handleUnenroll = async (sessionId: string) => {
    if (!user) return;

    setEnrolling(sessionId);
    try {
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Successfully unenrolled from session');
      fetchAvailableSessions();
    } catch (error) {
      console.error('Error unenrolling:', error);
      toast.error('Failed to unenroll from session');
    } finally {
      setEnrolling(null);
    }
  };

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.training_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Loading available sessions...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Available Sessions</h2>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming sessions available</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <Card 
                key={session.id} 
                className={`p-4 border ${session.is_enrolled ? 'border-green-500/50 bg-green-500/5' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{session.title}</h3>
                      <p className="text-sm text-muted-foreground">{session.training_title}</p>
                    </div>
                    {session.is_enrolled && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Enrolled
                      </Badge>
                    )}
                  </div>

                  {session.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {session.description}
                    </p>
                  )}

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(session.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{session.start_time} - {session.end_time}</span>
                    </div>
                    {session.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{session.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{session.participant_count} enrolled</span>
                    </div>
                  </div>

                  {session.trainer_name && (
                    <p className="text-xs text-muted-foreground">
                      Trainer: {session.trainer_name}
                    </p>
                  )}

                  <div className="pt-2">
                    {session.is_enrolled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleUnenroll(session.id)}
                        disabled={enrolling === session.id}
                      >
                        {enrolling === session.id ? 'Processing...' : 'Unenroll'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setConfirmSession(session)}
                        disabled={enrolling === session.id}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Enroll Now
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmSession} onOpenChange={() => setConfirmSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Enrollment</DialogTitle>
            <DialogDescription>
              You are about to enroll in the following session:
            </DialogDescription>
          </DialogHeader>

          {confirmSession && (
            <div className="py-4 space-y-3">
              <div>
                <h3 className="font-medium text-foreground">{confirmSession.title}</h3>
                <p className="text-sm text-muted-foreground">{confirmSession.training_title}</p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(confirmSession.scheduled_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{confirmSession.start_time} - {confirmSession.end_time}</span>
                </div>
                {confirmSession.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{confirmSession.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSession(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmSession && handleEnroll(confirmSession)}
              disabled={enrolling !== null}
            >
              {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}