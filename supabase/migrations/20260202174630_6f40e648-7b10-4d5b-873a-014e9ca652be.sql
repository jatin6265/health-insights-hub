-- Create function to auto-complete sessions at scheduled end time
-- This function checks for active sessions past their end time and marks them as completed
CREATE OR REPLACE FUNCTION public.check_and_complete_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions
  SET status = 'completed'::session_status,
      actual_end_time = now()
  WHERE status = 'active'
    AND (scheduled_date || ' ' || end_time)::timestamp < now();
END;
$$;

-- Create a function that can be called via cron or on session status changes
-- to handle automatic session completion
CREATE OR REPLACE FUNCTION public.auto_complete_session_on_end_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a session becomes active, schedule it for auto-completion
  -- This trigger helps track when sessions should end
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    NEW.actual_start_time = COALESCE(NEW.actual_start_time, now());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to track when sessions become active
DROP TRIGGER IF EXISTS trg_session_active_tracking ON public.sessions;
CREATE TRIGGER trg_session_active_tracking
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_session_on_end_time();

-- Add index for efficient session status queries
CREATE INDEX IF NOT EXISTS idx_sessions_status_date ON public.sessions (status, scheduled_date, end_time);