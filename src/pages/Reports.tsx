import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Download,
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  total: number;
}

interface SessionStats {
  sessionId: string;
  sessionTitle: string;
  trainingTitle: string;
  date: string;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

interface TrainingStats {
  trainingId: string;
  title: string;
  totalSessions: number;
  avgAttendanceRate: number;
  completedSessions: number;
}

export default function Reports() {
  const { user, loading, isAdmin, isTrainer } = useAuth();
  const navigate = useNavigate();
  const [overallStats, setOverallStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, total: 0 });
  const [sessionStats, setSessionStats] = useState<SessionStats[]>([]);
  const [trainingStats, setTrainingStats] = useState<TrainingStats[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string>('all');
  const [trainings, setTrainings] = useState<{ id: string; title: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && !isAdmin && !isTrainer) {
      navigate('/');
    }
  }, [user, loading, isAdmin, isTrainer, navigate]);

  useEffect(() => {
    if (user && (isAdmin || isTrainer)) {
      fetchReportData();
    }
  }, [user, isAdmin, isTrainer, selectedTraining]);

  const fetchReportData = async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      // Fetch trainings for filter
      const { data: trainingsData } = await supabase
        .from('trainings')
        .select('id, title')
        .eq('is_active', true);
      setTrainings(trainingsData || []);

      // Build session query
      let sessionQuery = supabase.from('sessions').select('id, title, scheduled_date, training_id, trainings(title)');
      
      if (!isAdmin) {
        sessionQuery = sessionQuery.eq('trainer_id', user.id);
      }
      
      if (selectedTraining !== 'all') {
        sessionQuery = sessionQuery.eq('training_id', selectedTraining);
      }

      const { data: sessions } = await sessionQuery;

      if (!sessions || sessions.length === 0) {
        setOverallStats({ present: 0, late: 0, absent: 0, total: 0 });
        setSessionStats([]);
        setTrainingStats([]);
        setLoadingData(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // Fetch all attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('session_id, status')
        .in('session_id', sessionIds);

      // Calculate overall stats
      const overall: AttendanceStats = { present: 0, late: 0, absent: 0, total: 0 };
      attendance?.forEach(a => {
        overall.total++;
        if (a.status === 'present') overall.present++;
        else if (a.status === 'late') overall.late++;
        else if (a.status === 'absent') overall.absent++;
      });
      setOverallStats(overall);

      // Calculate per-session stats
      const sessionStatsMap = new Map<string, SessionStats>();
      sessions.forEach(s => {
        sessionStatsMap.set(s.id, {
          sessionId: s.id,
          sessionTitle: s.title,
          trainingTitle: (s.trainings as { title: string })?.title || 'Unknown',
          date: s.scheduled_date,
          present: 0,
          late: 0,
          absent: 0,
          attendanceRate: 0,
        });
      });

      attendance?.forEach(a => {
        const stat = sessionStatsMap.get(a.session_id);
        if (stat) {
          if (a.status === 'present') stat.present++;
          else if (a.status === 'late') stat.late++;
          else if (a.status === 'absent') stat.absent++;
        }
      });

      const sessionStatsList = Array.from(sessionStatsMap.values()).map(s => {
        const total = s.present + s.late + s.absent;
        return {
          ...s,
          attendanceRate: total > 0 ? Math.round(((s.present + s.late) / total) * 100) : 0,
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setSessionStats(sessionStatsList);

      // Calculate per-training stats
      const trainingStatsMap = new Map<string, TrainingStats>();
      sessions.forEach(s => {
        if (!trainingStatsMap.has(s.training_id)) {
          trainingStatsMap.set(s.training_id, {
            trainingId: s.training_id,
            title: (s.trainings as { title: string })?.title || 'Unknown',
            totalSessions: 0,
            avgAttendanceRate: 0,
            completedSessions: 0,
          });
        }
        const stat = trainingStatsMap.get(s.training_id)!;
        stat.totalSessions++;
      });

      sessionStatsList.forEach(s => {
        const training = sessions.find(sess => sess.id === s.sessionId);
        if (training) {
          const stat = trainingStatsMap.get(training.training_id);
          if (stat) {
            stat.avgAttendanceRate += s.attendanceRate;
            if (s.present + s.late + s.absent > 0) stat.completedSessions++;
          }
        }
      });

      const trainingStatsList = Array.from(trainingStatsMap.values()).map(t => ({
        ...t,
        avgAttendanceRate: t.completedSessions > 0 ? Math.round(t.avgAttendanceRate / t.completedSessions) : 0,
      }));

      setTrainingStats(trainingStatsList);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoadingData(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Session', 'Training', 'Date', 'Present', 'Late', 'Absent', 'Attendance Rate'];
    const rows = sessionStats.map(s => [
      s.sessionTitle,
      s.trainingTitle,
      s.date,
      s.present,
      s.late,
      s.absent,
      `${s.attendanceRate}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Present', value: overallStats.present, fill: 'hsl(var(--chart-2))' },
    { name: 'Late', value: overallStats.late, fill: 'hsl(var(--chart-4))' },
    { name: 'Absent', value: overallStats.absent, fill: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  const barData = sessionStats.slice(0, 10).map(s => ({
    name: s.sessionTitle.length > 15 ? s.sessionTitle.substring(0, 15) + '...' : s.sessionTitle,
    present: s.present,
    late: s.late,
    absent: s.absent,
  }));

  const chartConfig = {
    present: { label: 'Present', color: 'hsl(var(--chart-2))' },
    late: { label: 'Late', color: 'hsl(var(--chart-4))' },
    absent: { label: 'Absent', color: 'hsl(var(--destructive))' },
  };

  const attendanceRate = overallStats.total > 0 
    ? Math.round(((overallStats.present + overallStats.late) / overallStats.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Attendance Reports</h1>
              <p className="text-muted-foreground">Analytics and insights for training attendance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedTraining} onValueChange={setSelectedTraining}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by training" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainings</SelectItem>
                {trainings.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} disabled={sessionStats.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold text-foreground">{overallStats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-foreground">{overallStats.present}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Late</p>
                <p className="text-2xl font-bold text-foreground">{overallStats.late}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-foreground">{overallStats.absent}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Attendance Rate Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Attendance Rate</p>
                <p className="text-4xl font-bold text-foreground">{attendanceRate}%</p>
              </div>
            </div>
            <Badge variant={attendanceRate >= 80 ? 'default' : attendanceRate >= 60 ? 'secondary' : 'destructive'} className="text-lg px-4 py-2">
              {attendanceRate >= 80 ? 'Excellent' : attendanceRate >= 60 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </div>
        </Card>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              By Session
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Detailed Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Attendance Distribution</h3>
                {pieData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-72">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No attendance data available
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Training Programs Summary</h3>
                {trainingStats.length > 0 ? (
                  <div className="space-y-4">
                    {trainingStats.map(t => (
                      <div key={t.trainingId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-foreground">{t.title}</h4>
                          <Badge variant="secondary">{t.avgAttendanceRate}% avg</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{t.totalSessions} sessions</span>
                          <span>{t.completedSessions} with attendance</span>
                        </div>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${t.avgAttendanceRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No training data available
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sessions">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Attendance by Session (Last 10)</h3>
              {barData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-80">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="present" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill="hsl(var(--chart-4))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="absent" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No session data available
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Attendance Data</h3>
              {sessionStats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionStats.map(s => (
                      <TableRow key={s.sessionId}>
                        <TableCell className="font-medium text-foreground">{s.sessionTitle}</TableCell>
                        <TableCell className="text-muted-foreground">{s.trainingTitle}</TableCell>
                        <TableCell>{new Date(s.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">{s.present}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600">{s.late}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">{s.absent}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.attendanceRate >= 80 ? 'default' : s.attendanceRate >= 60 ? 'secondary' : 'destructive'}>
                            {s.attendanceRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  No detailed data available
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
