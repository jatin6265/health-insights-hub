import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  TrendingUp,
  BookOpen,
  Save,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface TrainingHistory {
  trainingId: string;
  trainingTitle: string;
  totalSessions: number;
  attendedSessions: number;
  completionRate: number;
  startDate: string | null;
  endDate: string | null;
}

interface AttendanceRecord {
  id: string;
  sessionTitle: string;
  trainingTitle: string;
  date: string;
  time: string;
  status: string;
  joinTime: string | null;
}

export default function Profile() {
  const { user, profile, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistory[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({
    totalTrainings: 0,
    completedTrainings: 0,
    totalSessions: 0,
    attendedSessions: 0,
    overallAttendanceRate: 0,
  });
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    department: '',
  });

  useEffect(() => {
    if (user && profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        department: profile.department || '',
      });
      fetchProfileData();
    }
  }, [user, profile]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      // Get all sessions the user is enrolled in
      const { data: participations } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) {
        setLoading(false);
        return;
      }

      const sessionIds = participations.map(p => p.session_id);

      // Get session details with trainings
      const { data: sessions } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          scheduled_date,
          start_time,
          end_time,
          status,
          training_id,
          trainings (id, title, start_date, end_date)
        `)
        .in('id', sessionIds)
        .order('scheduled_date', { ascending: false });

      // Get attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionIds);

      const attendanceMap = new Map(attendance?.map(a => [a.session_id, a]) || []);

      // Build attendance records
      const records: AttendanceRecord[] = (sessions || []).map(s => ({
        id: s.id,
        sessionTitle: s.title,
        trainingTitle: (s.trainings as any)?.title || 'N/A',
        date: s.scheduled_date,
        time: `${s.start_time} - ${s.end_time}`,
        status: attendanceMap.get(s.id)?.status || (s.status === 'completed' ? 'absent' : 'pending'),
        joinTime: attendanceMap.get(s.id)?.join_time || null,
      }));

      setAttendanceRecords(records);

      // Calculate training history
      const trainingMap = new Map<string, {
        title: string;
        sessions: string[];
        attended: number;
        startDate: string | null;
        endDate: string | null;
      }>();

      (sessions || []).forEach(s => {
        const training = s.trainings as any;
        if (!training) return;

        if (!trainingMap.has(training.id)) {
          trainingMap.set(training.id, {
            title: training.title,
            sessions: [],
            attended: 0,
            startDate: training.start_date,
            endDate: training.end_date,
          });
        }

        const entry = trainingMap.get(training.id)!;
        entry.sessions.push(s.id);

        const att = attendanceMap.get(s.id);
        if (att && (att.status === 'present' || att.status === 'late')) {
          entry.attended++;
        }
      });

      const history: TrainingHistory[] = Array.from(trainingMap.entries()).map(([id, data]) => ({
        trainingId: id,
        trainingTitle: data.title,
        totalSessions: data.sessions.length,
        attendedSessions: data.attended,
        completionRate: data.sessions.length > 0 
          ? Math.round((data.attended / data.sessions.length) * 100) 
          : 0,
        startDate: data.startDate,
        endDate: data.endDate,
      }));

      setTrainingHistory(history);

      // Calculate overall stats
      const totalSessions = records.filter(r => r.status !== 'pending').length;
      const attended = records.filter(r => r.status === 'present' || r.status === 'late').length;

      setStats({
        totalTrainings: history.length,
        completedTrainings: history.filter(h => h.completionRate === 100).length,
        totalSessions: sessions?.length || 0,
        attendedSessions: attended,
        overallAttendanceRate: totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 100,
      });

    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          department: formData.department,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshUserData();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500">Present</Badge>;
      case 'late':
        return <Badge className="bg-amber-500">Late</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      case 'partial':
        return <Badge variant="secondary">Partial</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground">View your training history and attendance records</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trainings</p>
                <p className="text-xl font-bold text-foreground">{stats.totalTrainings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-bold text-foreground">{stats.completedTrainings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="text-xl font-bold text-foreground">{stats.totalSessions}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attended</p>
                <p className="text-xl font-bold text-foreground">{stats.attendedSessions}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className="text-xl font-bold text-foreground">{stats.overallAttendanceRate}%</p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="trainings">
              <BookOpen className="w-4 h-4 mr-2" />
              Training History
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Clock className="w-4 h-4 mr-2" />
              Attendance Records
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Training History Tab */}
          <TabsContent value="trainings">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Training History</h2>
              {trainingHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No training history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {trainingHistory.map((training) => (
                    <Card key={training.trainingId} className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{training.trainingTitle}</h3>
                          <p className="text-sm text-muted-foreground">
                            {training.startDate && training.endDate
                              ? `${format(new Date(training.startDate), 'MMM d, yyyy')} - ${format(new Date(training.endDate), 'MMM d, yyyy')}`
                              : 'Dates not set'}
                          </p>
                        </div>
                        <Badge variant={training.completionRate === 100 ? 'default' : 'secondary'}>
                          {training.completionRate === 100 ? 'Completed' : 'In Progress'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {training.attendedSessions} of {training.totalSessions} sessions attended
                          </span>
                          <span className="font-medium text-foreground">{training.completionRate}%</span>
                        </div>
                        <Progress value={training.completionRate} className="h-2" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Attendance Records Tab */}
          <TabsContent value="attendance">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Attendance Records</h2>
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.sessionTitle}</TableCell>
                        <TableCell>{record.trainingTitle}</TableCell>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{record.time}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>
                          {record.joinTime
                            ? format(new Date(record.joinTime), 'HH:mm:ss')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
