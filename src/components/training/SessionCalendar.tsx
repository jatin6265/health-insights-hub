import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, GripVertical, Clock, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { toast } from '@/components/ui/use-toast';
import { Session } from '@/types/auth';

interface SessionWithDetails extends Session {
  training?: { title: string };
  trainer?: { full_name: string };
}

export function SessionCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [updating, setUpdating] = useState(false);
  const [draggedSession, setDraggedSession] = useState<SessionWithDetails | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [currentMonth]);

  const fetchSessions = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .gte('scheduled_date', format(start, 'yyyy-MM-dd'))
      .lte('scheduled_date', format(end, 'yyyy-MM-dd'))
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }

    // Fetch training titles
    const trainingIds = [...new Set((data || []).map(s => s.training_id))];
    const { data: trainingsData } = await supabase
      .from('trainings')
      .select('id, title')
      .in('id', trainingIds);

    // Fetch trainer names
    const trainerIds = [...new Set((data || []).filter(s => s.trainer_id).map(s => s.trainer_id))];
    const { data: trainersData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', trainerIds);

    const sessionsWithDetails = (data || []).map(session => ({
      ...session,
      training: trainingsData?.find(t => t.id === session.training_id),
      trainer: trainersData?.find(t => t.id === session.trainer_id)
    }));

    setSessions(sessionsWithDetails);
    setLoading(false);
  };

  const handleDragStart = (e: React.DragEvent, session: SessionWithDetails) => {
    setDraggedSession(session);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (!draggedSession) return;

    const newDate = format(date, 'yyyy-MM-dd');
    
    const { error } = await supabase
      .from('sessions')
      .update({ scheduled_date: newDate })
      .eq('id', draggedSession.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to reschedule session',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Session rescheduled',
        description: `Moved to ${format(date, 'MMMM d, yyyy')}`
      });
      fetchSessions();
    }
    setDraggedSession(null);
  };

  const getSessionsForDay = (date: Date) => {
    return sessions.filter(session => 
      isSameDay(parseISO(session.scheduled_date), date)
    );
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-secondary text-secondary-foreground';
      case 'completed': return 'bg-muted text-muted-foreground';
      case 'cancelled': return 'bg-destructive/20 text-destructive';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const startDay = startOfMonth(currentMonth).getDay();
  const emptyDays = Array(startDay).fill(null);

  const handleSessionClick = (session: SessionWithDetails) => {
    setSelectedSession(session);
    setEditDate(session.scheduled_date);
    setEditStartTime(session.start_time);
    setEditEndTime(session.end_time);
    setEditLocation(session.location || '');
    setShowEditDialog(true);
  };

  const handleUpdateSession = async () => {
    if (!selectedSession) return;
    setUpdating(true);

    const { error } = await supabase
      .from('sessions')
      .update({
        scheduled_date: editDate,
        start_time: editStartTime,
        end_time: editEndTime,
        location: editLocation || null
      })
      .eq('id', selectedSession.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update session',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Session updated successfully'
      });
      setShowEditDialog(false);
      setSelectedSession(null);
      fetchSessions();
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Session Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {emptyDays.map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[100px] bg-muted/30 rounded-lg" />
          ))}
          
          {days.map(day => {
            const daySessions = getSessionsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] border rounded-lg p-1 transition-colors ${
                  isToday ? 'border-primary bg-primary/5' : 'border-border'
                } ${draggedSession ? 'hover:bg-primary/10' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday ? 'text-primary' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {daySessions.slice(0, 3).map(session => (
                    <div
                      key={session.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, session)}
                      onClick={() => handleSessionClick(session)}
                      className={`text-xs p-1.5 rounded cursor-move flex items-center gap-1 group hover:ring-2 hover:ring-primary/50 ${getStatusColor(session.status)}`}
                    >
                      <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      <span className="truncate flex-1">{session.title}</span>
                    </div>
                  ))}
                  {daySessions.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{daySessions.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary/20" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-secondary" />
            <span>Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive/20" />
            <span>Cancelled</span>
          </div>
        </div>
      </CardContent>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              {selectedSession?.title} - {selectedSession?.training?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedSession.start_time} - {selectedSession.end_time}</span>
                </div>
                {selectedSession.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedSession.location}</span>
                  </div>
                )}
                <div>
                  <Badge className={getStatusColor(selectedSession.status)}>
                    {selectedSession.status}
                  </Badge>
                </div>
                {selectedSession.trainer?.full_name && (
                  <div className="text-muted-foreground">
                    Trainer: {selectedSession.trainer.full_name}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-start">Start Time</Label>
                    <Input
                      id="edit-start"
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end">End Time</Label>
                    <Input
                      id="edit-end"
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Room 101 or Zoom link"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSession} disabled={updating}>
              {updating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
