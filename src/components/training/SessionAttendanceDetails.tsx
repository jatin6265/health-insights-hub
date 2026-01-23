import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { AttendanceStatus } from '@/types/auth';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  status: string;
  training_title: string;
}

interface ParticipantAttendance {
  user_id: string;
  full_name: string;
  email: string;
  attendance_status: AttendanceStatus | null;
  join_time: string | null;
}

export function SessionAttendanceDetails() {
  const { user, isAdmin, isTrainer } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [detailDialog, setDetailDialog] = useState<ParticipantAttendance | null>(null);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<Session | null>(null);

  // Real-time attendance updates
  const { attendanceList } = useRealtimeAttendance({
    sessionId: selectedSession,
    enabled: !!selectedSession && selectedSessionDetails?.status === 'active',
  });

  // Update participants when real-time attendance changes
  useEffect(() => {
    if (attendanceList.length > 0 && participants.length > 0) {
      setParticipants(prev => {
        return prev.map(p => {
          const realtimeRecord = attendanceList.find(a => a.user_id === p.user_id);
          if (realtimeRecord) {
            return {
              ...p,
              attendance_status: realtimeRecord.status as AttendanceStatus,
              join_time: realtimeRecord.join_time,
            };
          }
          return p;
        });
      });
    }
  }, [attendanceList]);

  useEffect(() => {
    if (user && (isAdmin || isTrainer)) {
      fetchSessions();
    }
  }, [user, isAdmin, isTrainer]);

  useEffect(() => {
    if (selectedSession) {
      fetchParticipants();
      const session = sessions.find(s => s.id === selectedSession);
      setSelectedSessionDetails(session || null);
    }
  }, [selectedSession, sessions]);

  const fetchSessions = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('sessions')
        .select(`
          id,
          title,
          scheduled_date,
          start_time,
          status,
          trainings (title)
        `)
        .order('scheduled_date', { ascending: false });

      if (!isAdmin) {
        query = query.eq('trainer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        status: s.status,
        training_title: (s.trainings as { title: string })?.title || 'No Training',
      }));

      setSessions(mapped);
      if (mapped.length > 0 && !selectedSession) {
        setSelectedSession(mapped[0].id);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedSession) return;
    setLoadingParticipants(true);

    try {
      // Fetch session participants
      const { data: participantsData, error: partError } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', selectedSession);

      if (partError) throw partError;

      const userIds = participantsData?.map(p => p.user_id) || [];

      if (userIds.length === 0) {
        setParticipants([]);
        setLoadingParticipants(false);
        return;
      }

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Fetch attendance records
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('user_id, status, join_time')
        .eq('session_id', selectedSession);

      if (attError) throw attError;

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const attendanceMap = new Map(attendanceData?.map(a => [a.user_id, a]) || []);

      const mapped: ParticipantAttendance[] = userIds.map(userId => {
        const profile = profilesMap.get(userId);
        const attendance = attendanceMap.get(userId);
        return {
          user_id: userId,
          full_name: profile?.full_name || 'Unknown',
          email: profile?.email || '',
          attendance_status: (attendance?.status as AttendanceStatus) || null,
          join_time: attendance?.join_time || null,
        };
      });

      // Sort by name
      mapped.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setParticipants(mapped);
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Failed to load participants');
    } finally {
      setLoadingParticipants(false);
    }
  };

  const getAttendanceBadge = (status: AttendanceStatus | null) => {
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

  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 animate-pulse">Active</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: participants.length,
    present: participants.filter(p => p.attendance_status === 'present').length,
    late: participants.filter(p => p.attendance_status === 'late').length,
    absent: participants.filter(p => p.attendance_status === 'absent').length,
    pending: participants.filter(p => !p.attendance_status).length,
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading sessions...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Session Attendance Details</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <span>{s.title}</span>
                    <span className="text-xs text-muted-foreground">({s.scheduled_date})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchParticipants}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {selectedSessionDetails && (
        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">{selectedSessionDetails.title}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedSessionDetails.training_title} • {selectedSessionDetails.scheduled_date} at {selectedSessionDetails.start_time}
              </p>
            </div>
            {getSessionStatusBadge(selectedSessionDetails.status)}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-3 bg-muted/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="p-3 bg-green-500/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-xs text-muted-foreground">Present</p>
        </div>
        <div className="p-3 bg-amber-500/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
          <p className="text-xs text-muted-foreground">Late</p>
        </div>
        <div className="p-3 bg-destructive/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
          <p className="text-xs text-muted-foreground">Absent</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
      </div>

      {loadingParticipants ? (
        <div className="text-center py-8 text-muted-foreground">Loading participants...</div>
      ) : participants.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No participants assigned to this session
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(participant => (
              <TableRow key={participant.user_id}>
                <TableCell className="font-medium">{participant.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{participant.email}</TableCell>
                <TableCell>{getAttendanceBadge(participant.attendance_status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {participant.join_time
                    ? new Date(participant.join_time).toLocaleTimeString()
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailDialog(participant)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Participant Details</DialogTitle>
            <DialogDescription>
              Attendance details for {detailDialog?.full_name}
            </DialogDescription>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{detailDialog.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{detailDialog.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getAttendanceBadge(detailDialog.attendance_status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Join Time</p>
                  <p className="font-medium">
                    {detailDialog.join_time
                      ? new Date(detailDialog.join_time).toLocaleString()
                      : 'Not recorded'}
                  </p>
                </div>
              </div>
              {selectedSessionDetails && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Session</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {selectedSessionDetails.title} - {selectedSessionDetails.scheduled_date}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
