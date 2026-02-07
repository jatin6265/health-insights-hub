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
  session_start_time: string;
  late_threshold_minutes: number;
  partial_threshold_minutes: number;
}

function calculateAttendanceType(
  requestedAt: Date,
  sessionStart: Date,
  lateThreshold: number,
  partialThreshold: number
): 'on_time' | 'late' | 'partial' {
  const delayMs = requestedAt.getTime() - sessionStart.getTime();
  const delayMinutes = delayMs / 60000;

  if (delayMinutes <= lateThreshold) {
    return 'on_time';
  } else if (delayMinutes <= partialThreshold) {
    return 'late';
  } else {
    return 'partial';
  }
}

export function TrainerJoinRequests() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter requests based on search
  const filteredRequests = useMemo(() => {
    if (!searchTerm.trim()) return requests;
    const term = searchTerm.toLowerCase();
    return requests.filter(r =>
      r.trainee_name?.toLowerCase().includes(term) ||
      r.trainee_email?.toLowerCase().includes(term) ||
      r.session_title.toLowerCase().includes(term)
    );
  }, [requests, searchTerm]);

  // Pagination
  const pagination = usePagination(filteredRequests, { initialPageSize: 10 });

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
      const { data: trainerSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, title, scheduled_date, start_time, late_threshold_minutes, partial_threshold_minutes')
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
          session_start_time: session?.start_time || '',
          late_threshold_minutes: session?.late_threshold_minutes ?? 15,
          partial_threshold_minutes: session?.partial_threshold_minutes ?? 30,
        };
      });

      setRequests(mapped);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load attendance requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    setProcessing(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('process-attendance-request', {
        body: { requestId: request.id, action: 'approve' },
      });

      if (error) throw error;

      const attendanceType = (data as any)?.attendanceType as
        | 'on_time'
        | 'late'
        | 'partial'
        | undefined;

      const typeLabel = attendanceType === 'on_time'
        ? 'ON TIME'
        : attendanceType === 'late'
          ? 'LATE'
          : attendanceType === 'partial'
            ? 'PARTIAL'
            : 'PRESENT';

      toast.success(`Approved! ${request.trainee_name || 'Trainee'} marked as ${typeLabel}`);
      fetchPendingRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve attendance');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: JoinRequest) => {
    setProcessing(request.id);
    try {
      const { error } = await supabase.functions.invoke('process-attendance-request', {
        body: { requestId: request.id, action: 'reject' },
      });

      if (error) throw error;

      toast.success(`Rejected attendance request`);
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

  const getExpectedType = (request: JoinRequest): 'on_time' | 'late' | 'partial' => {
    const requestedAt = new Date(request.requested_at);
    const sessionStart = new Date(`${request.session_date}T${request.session_start_time}+00:00`);
    return calculateAttendanceType(
      requestedAt,
      sessionStart,
      request.late_threshold_minutes,
      request.partial_threshold_minutes
    );
  };

  const getTypeBadge = (type: 'on_time' | 'late' | 'partial') => {
    switch (type) {
      case 'on_time':
        return <Badge className="bg-primary text-primary-foreground">On Time</Badge>;
      case 'late':
        return <Badge variant="secondary">Late</Badge>;
      case 'partial':
        return <Badge variant="outline">Partial</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const renderRequestActions = (request: JoinRequest) => (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleReject(request)}
        disabled={processing === request.id}
        className="text-destructive hover:bg-destructive/10"
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
        className="bg-primary hover:bg-primary/90"
      >
        {processing === request.id ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Check className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Approve</span>
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Attendance Requests</h2>
        </div>
        {requests.length > 0 && (
          <Badge variant="secondary">{requests.length} pending</Badge>
        )}
      </div>

      {/* Search */}
      {requests.length > 0 && (
        <div className="mb-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by trainee or session..."
            containerClassName="max-w-md"
          />
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchTerm ? (
            <p>No requests found matching "{searchTerm}"</p>
          ) : (
            <p>No pending attendance requests</p>
          )}
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <MobileCardList>
          {pagination.paginatedData.map((request) => {
            const expectedType = getExpectedType(request);
            return (
              <MobileCardItem key={request.id}>
                <MobileCardHeader
                  title={request.trainee_name || 'Unknown Trainee'}
                  subtitle={request.trainee_email}
                  badge={getTypeBadge(expectedType)}
                />
                <MobileCardBody>
                  <MobileCardRow
                    label="Session"
                    value={request.session_title}
                  />
                  <MobileCardRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Date"
                    value={formatDate(request.session_date)}
                  />
                  <MobileCardRow
                    icon={<Clock className="w-4 h-4" />}
                    label="Time"
                    value={request.session_time}
                  />
                  <MobileCardRow
                    label="Requested"
                    value={formatTime(request.requested_at)}
                  />
                </MobileCardBody>
                <MobileCardActions>
                  {renderRequestActions(request)}
                </MobileCardActions>
              </MobileCardItem>
            );
          })}
        </MobileCardList>
      ) : (
        /* Desktop List View */
        <div className="space-y-4">
          {pagination.paginatedData.map((request) => {
            const expectedType = getExpectedType(request);
            return (
              <div
                key={request.id}
                className="p-4 border rounded-lg bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">
                        {request.trainee_name || 'Unknown Trainee'}
                      </h3>
                      {getTypeBadge(expectedType)}
                    </div>
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

                  {renderRequestActions(request)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredRequests.length > 0 && (
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
      )}
    </Card>
  );
}
