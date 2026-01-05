import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  training_title: string;
}

interface Participant {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  assigned_at: string;
  attendance_status?: 'present' | 'late' | 'absent' | null;
}

interface AvailableUser {
  id: string;
  full_name: string;
  email: string;
}

export function ParticipantManagement() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingParticipants, setAddingParticipants] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchParticipants();
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, scheduled_date, trainings(title)')
        .in('status', ['scheduled', 'active'])
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        scheduled_date: s.scheduled_date,
        training_title: (s.trainings as { title: string })?.title || 'Unknown',
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

    try {
      // Fetch participants for this session
      const { data: participantsData, error } = await supabase
        .from('session_participants')
        .select('id, user_id, assigned_at')
        .eq('session_id', selectedSession);

      if (error) throw error;

      const userIds = participantsData?.map(p => p.user_id) || [];

      if (userIds.length === 0) {
        setParticipants([]);
        return;
      }

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Fetch attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('session_id', selectedSession);

      const attendanceMap = new Map(attendance?.map(a => [a.user_id, a.status as 'present' | 'late' | 'absent']));
      const profilesMap = new Map(profiles?.map(p => [p.id, p]));

      const mapped: Participant[] = (participantsData || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: profilesMap.get(p.user_id)?.full_name || 'Unknown',
        email: profilesMap.get(p.user_id)?.email || '',
        assigned_at: p.assigned_at,
        attendance_status: attendanceMap.get(p.user_id) || null,
      }));

      setParticipants(mapped);
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Failed to load participants');
    }
  };

  const fetchAvailableUsers = async () => {
    if (!selectedSession) return;

    try {
      // Get all active trainees
      const { data: trainees, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainee');

      if (rolesError) throw rolesError;

      const traineeIds = trainees?.map(t => t.user_id) || [];

      if (traineeIds.length === 0) {
        setAvailableUsers([]);
        return;
      }

      // Get active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('status', 'active')
        .in('id', traineeIds);

      if (profilesError) throw profilesError;

      // Filter out already assigned participants
      const assignedIds = new Set(participants.map(p => p.user_id));
      const available = (profiles || []).filter(p => !assignedIds.has(p.id));

      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast.error('Failed to load available users');
    }
  };

  const openAddDialog = () => {
    fetchAvailableUsers();
    setSelectedUsers(new Set());
    setSearchTerm('');
    setIsAddDialogOpen(true);
  };

  const handleAddParticipants = async () => {
    if (selectedUsers.size === 0 || !selectedSession || !user) return;

    setAddingParticipants(true);
    try {
      const userIdsArray = Array.from(selectedUsers);
      const inserts = userIdsArray.map(userId => ({
        session_id: selectedSession,
        user_id: userId,
        assigned_by: user.id,
      }));

      const { error } = await supabase
        .from('session_participants')
        .insert(inserts);

      if (error) throw error;

      // Send notification to assigned participants
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'session_assigned',
            sessionId: selectedSession,
            userIds: userIdsArray,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send assignment notifications:', notifyError);
        // Don't fail the main operation if notification fails
      }

      toast.success(`Added ${selectedUsers.size} participant(s) successfully`);
      setIsAddDialogOpen(false);
      fetchParticipants();
    } catch (error) {
      console.error('Error adding participants:', error);
      toast.error('Failed to add participants');
    } finally {
      setAddingParticipants(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, userName: string) => {
    try {
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast.success(`Removed ${userName} from session`);
      fetchParticipants();
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant');
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAll = () => {
    const filtered = filteredAvailableUsers;
    if (selectedUsers.size === filtered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map(u => u.id)));
    }
  };

  const filteredAvailableUsers = availableUsers.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAttendanceBadge = (status: 'present' | 'late' | 'absent' | null) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Present</Badge>;
      case 'late':
        return <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" /> Late</Badge>;
      case 'absent':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Absent</Badge>;
      default:
        return <Badge variant="outline">Not Marked</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === selectedSession);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Participant Management</h2>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} - {new Date(s.scheduled_date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openAddDialog} disabled={!selectedSession}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Participants
          </Button>
        </div>
      </div>

      {currentSession && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {currentSession.training_title} • {new Date(currentSession.scheduled_date).toLocaleDateString()}
          </span>
          <Badge variant="secondary">{participants.length} participants</Badge>
        </div>
      )}

      {!selectedSession ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a session to manage participants</p>
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No participants assigned to this session</p>
          <Button variant="link" onClick={openAddDialog}>
            Add your first participant
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.assigned_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{getAttendanceBadge(p.attendance_status)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveParticipant(p.id, p.full_name)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Participants Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Participants</DialogTitle>
            <DialogDescription>
              Select trainees to add to this session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredAvailableUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {availableUsers.length === 0 
                  ? 'No available trainees to add'
                  : 'No trainees match your search'
                }
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedUsers.size} of {filteredAvailableUsers.length} selected
                  </span>
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    {selectedUsers.size === filteredAvailableUsers.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {filteredAvailableUsers.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => toggleUserSelection(u.id)}
                    >
                      <Checkbox
                        checked={selectedUsers.has(u.id)}
                        onCheckedChange={() => toggleUserSelection(u.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{u.full_name || 'Unnamed'}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddParticipants} 
              disabled={selectedUsers.size === 0 || addingParticipants}
            >
              {addingParticipants ? 'Adding...' : `Add ${selectedUsers.size} Participant(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
