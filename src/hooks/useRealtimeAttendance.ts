import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttendanceUpdate {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  attendance_type?: 'on_time' | 'late' | 'partial' | null;
  join_time: string | null;
  user_name?: string;
}

interface UseRealtimeAttendanceProps {
  sessionId: string;
  enabled?: boolean;
}

export function useRealtimeAttendance({ sessionId, enabled = true }: UseRealtimeAttendanceProps) {
  const [attendanceList, setAttendanceList] = useState<AttendanceUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, session_id, user_id, status, attendance_type, join_time')
        .eq('session_id', sessionId);

      if (error) throw error;

      // Fetch user names
      const userIds = data?.map(a => a.user_id) || [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        setAttendanceList(
          data?.map(a => ({
            ...a,
            user_name: nameMap.get(a.user_id) || 'Unknown',
          })) || []
        );
      } else {
        setAttendanceList([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    fetchAttendance();

    // Subscribe to real-time attendance updates
    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          console.log('Attendance update:', payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = payload.new as AttendanceUpdate;
            
            // Fetch user name for the new/updated record
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', record.user_id)
              .single();

            const updatedRecord = {
              ...record,
              user_name: profile?.full_name || 'Unknown',
            };

            setAttendanceList(prev => {
              const existingIndex = prev.findIndex(a => a.user_id === record.user_id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = updatedRecord;
                return updated;
              }
              return [...prev, updatedRecord];
            });

            // Show toast for new attendance
            if (payload.eventType === 'INSERT') {
              const label = record.attendance_type || record.status;
              toast.success(`${profile?.full_name || 'A participant'} marked attendance (${label})`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, enabled, fetchAttendance]);

  return {
    attendanceList,
    loading,
    refresh: fetchAttendance,
  };
}
