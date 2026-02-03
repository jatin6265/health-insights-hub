import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that checks for sessions that should be auto-completed
 * and triggers the auto-complete edge function periodically
 * @param intervalMs - Check interval in milliseconds. Set to 0 to disable.
 */
export function useSessionAutoComplete(intervalMs: number = 60000) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't run if interval is 0 or less
    if (intervalMs <= 0) return;

    const checkAndCompleteExpiredSessions = async () => {
      try {
        // Call the auto-complete edge function
        const { data, error } = await supabase.functions.invoke('auto-complete-sessions', {
          method: 'POST',
        });

        if (error) {
          console.error('Error calling auto-complete-sessions:', error);
          return;
        }

        if (data?.completed > 0) {
          console.log(`Auto-completed ${data.completed} sessions`);
        }
      } catch (error) {
        console.error('Error in session auto-complete check:', error);
      }
    };

    // Run immediately on mount
    checkAndCompleteExpiredSessions();

    // Then run at the specified interval
    intervalRef.current = setInterval(checkAndCompleteExpiredSessions, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMs]);
}
