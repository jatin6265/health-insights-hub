import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  PlusCircle,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  MoreVertical,
  User,
  Send,
  Loader2,
  Ban,
  CheckCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Session, SessionStatus } from '@/types/auth';
import { SessionForm } from './SessionForm';

interface SessionWithDetails extends Session {
  training?: { title: string };
  trainer?: { full_name: string | null };
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;

      // Fetch trainer names separately
      const trainerIds = [...new Set((data || []).map(s => s.trainer_id).filter(Boolean))];
      
      let trainersMap = new Map<string, string>();
      if (trainerIds.length > 0) {
        const { data: trainersData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', trainerIds);
        
        trainersData?.forEach(t => {
          trainersMap.set(t.id, t.full_name || '');
        });
      }

      const mapped: SessionWithDetails[] = (data || []).map(s => ({
        ...s,
        status: s.status as SessionStatus,
        late_threshold_minutes: s.late_threshold_minutes ?? 15,
        training: s.trainings as { title: string } | undefined,
        trainer: s.trainer_id ? { full_name: trainersMap.get(s.trainer_id) || null } : undefined,
      }));

      setSessions(mapped);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (data: {
    training_id: string;
    title: string;
    description?: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    location?: string;
    trainer_id?: string;
    late_threshold_minutes: number;
  }) => {
    setIsSubmitting(true);
    try {
      const { data: createdSession, error } = await supabase.from('sessions').insert({
        training_id: data.training_id,
        title: data.title,
        description: data.description || null,
        scheduled_date: data.scheduled_date,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location || null,
        trainer_id: data.trainer_id || null,
        late_threshold_minutes: data.late_threshold_minutes,
        status: 'scheduled',
      }).select('id, trainer_id').single();

      if (error) throw error;

      // Notify assigned trainer (if any)
      if (createdSession?.trainer_id) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'session_assigned',
              sessionId: createdSession.id,
              userIds: [createdSession.trainer_id],
              customMessage: 'You have been assigned to lead this session.',
            },
          });
        } catch (notifyError) {
          console.error('Failed to notify trainer:', notifyError);
        }
      }

      toast.success('Session created successfully');
      setIsFormOpen(false);
      fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSession = async (data: {
    training_id: string;
    title: string;
    description?: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    location?: string;
    trainer_id?: string;
    late_threshold_minutes: number;
  }) => {
    if (!editingSession) return;

    const prevTrainerId = editingSession.trainer_id || null;
    const nextTrainerId = data.trainer_id || null;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          training_id: data.training_id,
          title: data.title,
          description: data.description || null,
          scheduled_date: data.scheduled_date,
          start_time: data.start_time,
          end_time: data.end_time,
          location: data.location || null,
          trainer_id: nextTrainerId,
          late_threshold_minutes: data.late_threshold_minutes,
        })
        .eq('id', editingSession.id);

      if (error) throw error;

      // Notify newly assigned trainer (if changed)
      if (nextTrainerId && nextTrainerId !== prevTrainerId) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'session_assigned',
              sessionId: editingSession.id,
              userIds: [nextTrainerId],
              customMessage: 'You have been assigned to lead this session.',
            },
          });
        } catch (notifyError) {
          console.error('Failed to notify trainer:', notifyError);
        }
      }

      toast.success('Session updated successfully');
      setEditingSession(null);
      setIsFormOpen(false);
      fetchSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      toast.error('Failed to update session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deletingSession) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', deletingSession.id);

      if (error) throw error;

      toast.success('Session deleted successfully');
      setDeletingSession(null);
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const openEditForm = (session: Session) => {
    setEditingSession(session);
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingSession(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingSession(null);
    setIsFormOpen(false);
  };

  const handleSendReminder = async (sessionId: string) => {
    setSendingReminder(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'session_reminder',
          sessionId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Reminders sent successfully');
      } else {
        toast.error(data?.message || 'Failed to send reminders');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusBadge = (status: SessionStatus) => {
    const variants: Record<SessionStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive', className?: string }> = {
      scheduled: { variant: 'secondary' },
      active: { variant: 'default', className: 'bg-green-500 animate-pulse' },
      completed: { variant: 'outline' },
      cancelled: { variant: 'destructive' },
    };
    const config = variants[status];
    return (
      <Badge 
        variant={config.variant} 
        className={`capitalize ${config.className || ''}`}
      >
        {status}
      </Badge>
    );
  };

  const handleCancelSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session cancelled');
      fetchSessions();
    } catch (error) {
      console.error('Error cancelling session:', error);
      toast.error('Failed to cancel session');
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ 
          status: 'completed',
          actual_end_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session marked as completed');
      fetchSessions();
    } catch (error) {
      console.error('Error completing session:', error);
      toast.error('Failed to complete session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Training Sessions</h2>
        </div>
        <Button onClick={openCreateForm}>
          <PlusCircle className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No sessions scheduled yet</p>
          <Button variant="link" onClick={openCreateForm}>
            Schedule your first session
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Training</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{session.title}</p>
                    {session.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {session.location}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {session.training?.title || '-'}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className="text-foreground">{new Date(session.scheduled_date).toLocaleDateString()}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.start_time} - {session.end_time}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {session.trainer?.full_name ? (
                    <div className="flex items-center gap-1 text-sm">
                      <User className="w-3 h-3" />
                      {session.trainer.full_name}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(session.status)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditForm(session)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSendReminder(session.id)}
                        disabled={sendingReminder === session.id || session.status === 'cancelled'}
                      >
                        {sendingReminder === session.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send Reminder
                      </DropdownMenuItem>
                      {session.status === 'active' && (
                        <DropdownMenuItem onClick={() => handleCompleteSession(session.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete Session
                        </DropdownMenuItem>
                      )}
                      {session.status !== 'cancelled' && session.status !== 'completed' && (
                        <DropdownMenuItem 
                          className="text-amber-600"
                          onClick={() => handleCancelSession(session.id)}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Cancel Session
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeletingSession(session)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeletingSession(session)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'Edit Session' : 'Schedule New Session'}
            </DialogTitle>
          </DialogHeader>
          <SessionForm
            session={editingSession}
            onSubmit={editingSession ? handleUpdateSession : handleCreateSession}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingSession?.title}" and all associated attendance records.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSession}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
