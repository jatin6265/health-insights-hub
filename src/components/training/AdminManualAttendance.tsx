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
  DialogFooter,
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
  Edit,
  RefreshCw,
  Loader2,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { AttendanceStatus, SessionStatus } from '@/types/auth';

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  training_title: string;
}

interface ParticipantAttendance {
  user_id: string;
  full_name: string;
  email: string;
  attendance_id: string | null;
  attendance_status: AttendanceStatus | null;
  join_time: string | null;
}

export function AdminManualAttendance() {
  const { user, isAdmin, isTrainer } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantAttendance | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [saving, setSaving] = useState(false);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<Session | null>(null);

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
          end_time,
          status,
          trainings (title)
        `)
        .order('scheduled_date', { ascending: false });

      // Trainers can only see their own sessions
      if (!isAdmin) {
        query = query.eq('trainer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: Session[] = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status as SessionStatus,
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
        .select('id, user_id, status, join_time, attendance_type')
        .eq('session_id', selectedSession);

      if (attError) throw attError;

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const attendanceMap = new Map(attendanceData?.map(a => [a.user_id, a]) || []);

      const mapped: ParticipantAttendance[] = userIds.map(userId => {
        const profile = profilesMap.get(userId);
        const attendance = attendanceMap.get(userId) as any;
        const rawStatus = attendance?.status as AttendanceStatus | undefined;
        const type = attendance?.attendance_type as 'on_time' | 'late' | 'partial' | null | undefined;

        const derivedStatus: AttendanceStatus | null = !rawStatus
          ? null
          : rawStatus === 'present'
            ? (type === 'late' ? 'late' : type === 'partial' ? 'partial' : 'present')
            : rawStatus;

        return {
          user_id: userId,
          full_name: profile?.full_name || 'Unknown',
          email: profile?.email || '',
          attendance_id: attendance?.id || null,
          attendance_status: derivedStatus,
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

  const handleUpdateAttendance = async () => {
    if (!editingParticipant || !selectedSession) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-attendance', {
        body: {
          sessionId: selectedSession,
          userId: editingParticipant.user_id,
          status: newStatus,
        },
      });

      if (error) throw error;

      toast.success(`Attendance marked as ${newStatus} for ${editingParticipant.full_name}`);
      setEditingParticipant(null);
      fetchParticipants();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (participant: ParticipantAttendance) => {
    setEditingParticipant(participant);
    setNewStatus(participant.attendance_status || 'present');
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
            Not Marked
          </Badge>
        );
    }
  };

  const getSessionStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 animate-pulse">Active</Badge>;
      case 'scheduled':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'completed':
        return <Badge variant="outline">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: participants.length,
    present: participants.filter(p => p.attendance_status === 'present').length,
    late: participants.filter(p => p.attendance_status === 'late').length,
    partial: participants.filter(p => p.attendance_status === 'partial').length,
    absent: participants.filter(p => p.attendance_status === 'absent').length,
    notMarked: participants.filter(p => !p.attendance_status).length,
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
          <h2 className="text-lg font-semibold text-foreground">Manual Attendance Management</h2>
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
                    <span className="text-xs text-muted-foreground">
                      ({s.scheduled_date})
                    </span>
                    {s.status === 'cancelled' && (
                      <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                    )}
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
                {selectedSessionDetails.training_title} • {selectedSessionDetails.scheduled_date} at {selectedSessionDetails.start_time} - {selectedSessionDetails.end_time}
              </p>
            </div>
            {getSessionStatusBadge(selectedSessionDetails.status)}
          </div>
          {selectedSessionDetails.status === 'cancelled' && (
            <p className="text-sm text-destructive mt-2">
              This session has been cancelled. Attendance cannot be marked.
            </p>
          )}
          {selectedSessionDetails.status === 'completed' && (
            <p className="text-sm text-amber-600 mt-2">
              This session has ended. Manual attendance is not allowed for completed sessions.
            </p>
          )}
          {selectedSessionDetails.status === 'scheduled' && (
            <p className="text-sm text-muted-foreground mt-2">
              This session has not started yet. Manual attendance will be available once the session is active.
            </p>
          )}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
        <div className="p-3 bg-blue-500/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.partial}</p>
          <p className="text-xs text-muted-foreground">Partial</p>
        </div>
        <div className="p-3 bg-destructive/10 rounded-lg text-center">
          <p className="text-2xl font-bold text-destructive">{stats.absent}</p>
          <p className="text-xs text-muted-foreground">Absent</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-muted-foreground">{stats.notMarked}</p>
          <p className="text-xs text-muted-foreground">Not Marked</p>
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
                  {/* Manual attendance only allowed for active (live) sessions */}
                  {selectedSessionDetails?.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(participant)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Mark
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {selectedSessionDetails?.status === 'scheduled' ? 'Not started' : 'Session ended'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Attendance Dialog */}
      <Dialog open={!!editingParticipant} onOpenChange={() => setEditingParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>
              Update attendance status for {editingParticipant?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Participant</p>
                <p className="font-medium">{editingParticipant?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                {editingParticipant && getAttendanceBadge(editingParticipant.attendance_status)}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">New Status</p>
              <Select value={newStatus} onValueChange={(val) => setNewStatus(val as AttendanceStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Present
                    </div>
                  </SelectItem>
                  <SelectItem value="late">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Late
                    </div>
                  </SelectItem>
                  <SelectItem value="partial">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-500" />
                      Partial
                    </div>
                  </SelectItem>
                  <SelectItem value="absent">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Absent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedSessionDetails && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Session</p>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {selectedSessionDetails.title} - {selectedSessionDetails.scheduled_date}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingParticipant(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAttendance} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Attendance'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
