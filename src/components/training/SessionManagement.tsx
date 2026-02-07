import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  MobileCardList,
  MobileCardItem,
  MobileCardHeader,
  MobileCardBody,
  MobileCardRow,
  MobileCardActions,
} from '@/components/ui/mobile-card-list';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Filter,
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
  const { user, isAdmin, isTrainer } = useAuth();
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionWithDetails | null>(null);
  const [deletingSession, setDeletingSession] = useState<SessionWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter sessions based on search and status
  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(term) ||
        s.training?.title.toLowerCase().includes(term) ||
        s.trainer?.full_name?.toLowerCase().includes(term) ||
        s.location?.toLowerCase().includes(term)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    return filtered;
  }, [sessions, searchTerm, statusFilter]);

  // Pagination
  const pagination = usePagination(filteredSessions, { initialPageSize: 10 });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const query = supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .order('scheduled_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

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
        created_by: user?.id,
      }).select('id, trainer_id').single();

      if (error) throw error;

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

  const isSessionOwner = (session: SessionWithDetails): boolean => {
    if (!user) return false;
    return session.trainer_id === user.id || session.created_by === user.id;
  };

  const canEditSession = (session: SessionWithDetails): boolean => {
    if (session.status === 'active' || session.status === 'completed' || session.status === 'cancelled') {
      return false;
    }
    if (isAdmin) return true;
    return isTrainer && isSessionOwner(session);
  };

  const canDeleteSession = (session: SessionWithDetails): boolean => {
    if (isAdmin) return true;
    if (isTrainer && session.created_by === user?.id) {
      if (session.status !== 'scheduled') return false;
      return true;
    }
    return false;
  };

  const canCancelSession = (session: SessionWithDetails): boolean => {
    if (session.status === 'cancelled' || session.status === 'completed') return false;
    if (isAdmin) return true;
    return isTrainer && isSessionOwner(session);
  };

  const canCompleteSession = (session: SessionWithDetails): boolean => {
    if (session.status !== 'active') return false;
    if (isAdmin) return true;
    return isTrainer && isSessionOwner(session);
  };

  const canSendReminder = (session: SessionWithDetails): boolean => {
    if (session.status === 'cancelled') return false;
    if (isAdmin) return true;
    return isTrainer && isSessionOwner(session);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  const renderSessionActions = (session: SessionWithDetails) => {
    const hasActions = canEditSession(session) || canDeleteSession(session) || 
                       canCancelSession(session) || canCompleteSession(session) || 
                       canSendReminder(session);
    
    if (!hasActions) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEditSession(session) && (
            <DropdownMenuItem onClick={() => openEditForm(session)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canSendReminder(session) && (
            <DropdownMenuItem 
              onClick={() => handleSendReminder(session.id)}
              disabled={sendingReminder === session.id}
            >
              {sendingReminder === session.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Reminder
            </DropdownMenuItem>
          )}
          {canCompleteSession(session) && (
            <DropdownMenuItem onClick={() => handleCompleteSession(session.id)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Complete
            </DropdownMenuItem>
          )}
          {canCancelSession(session) && (
            <DropdownMenuItem 
              className="text-amber-600"
              onClick={() => handleCancelSession(session.id)}
            >
              <Ban className="w-4 h-4 mr-2" />
              Cancel Session
            </DropdownMenuItem>
          )}
          {canDeleteSession(session) && (
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => setDeletingSession(session)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <Card className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Training Sessions</h2>
        </div>
        <Button onClick={openCreateForm} className="w-full sm:w-auto">
          <PlusCircle className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search sessions..."
          containerClassName="flex-1 sm:max-w-md"
        />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchTerm || statusFilter !== 'all' ? (
            <p>No sessions found matching your filters</p>
          ) : (
            <>
              <p>No sessions scheduled yet</p>
              <Button variant="link" onClick={openCreateForm}>
                Schedule your first session
              </Button>
            </>
          )}
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <MobileCardList>
          {pagination.paginatedData.map((session) => (
            <MobileCardItem key={session.id}>
              <MobileCardHeader
                title={session.title}
                badge={getStatusBadge(session.status)}
                actions={renderSessionActions(session)}
              />
              <MobileCardBody>
                <MobileCardRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Date"
                  value={new Date(session.scheduled_date).toLocaleDateString()}
                />
                <MobileCardRow
                  icon={<Clock className="w-4 h-4" />}
                  label="Time"
                  value={`${session.start_time} - ${session.end_time}`}
                />
                {session.training?.title && (
                  <MobileCardRow
                    label="Training"
                    value={session.training.title}
                  />
                )}
                {session.trainer?.full_name && (
                  <MobileCardRow
                    icon={<User className="w-4 h-4" />}
                    label="Trainer"
                    value={session.trainer.full_name}
                  />
                )}
                {session.location && (
                  <MobileCardRow
                    icon={<MapPin className="w-4 h-4" />}
                    label="Location"
                    value={session.location}
                  />
                )}
              </MobileCardBody>
            </MobileCardItem>
          ))}
        </MobileCardList>
      ) : (
        /* Desktop Table View */
        <div className="overflow-x-auto">
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
              {pagination.paginatedData.map((session) => (
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
                    {renderSessionActions(session)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <DataTablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrev={pagination.canGoPrev}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'Edit Session' : 'Create New Session'}
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
              This will permanently delete "{deletingSession?.title}" and all associated data.
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
