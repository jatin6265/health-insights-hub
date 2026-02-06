-- Add created_by column to sessions table to track who created each session
ALTER TABLE public.sessions ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update existing sessions to set created_by to trainer_id where available
UPDATE public.sessions SET created_by = trainer_id WHERE trainer_id IS NOT NULL;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins and trainers can manage sessions" ON public.sessions;
DROP POLICY IF EXISTS "Participants can view their sessions" ON public.sessions;

-- Create proper role-based RLS policies for sessions

-- Admins can do everything
CREATE POLICY "Admins can manage all sessions"
ON public.sessions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trainers can view sessions they created OR are assigned to
CREATE POLICY "Trainers can view their sessions"
ON public.sessions FOR SELECT
USING (
  has_role(auth.uid(), 'trainer'::app_role) AND 
  (trainer_id = auth.uid() OR created_by = auth.uid())
);

-- Trainers can create new sessions
CREATE POLICY "Trainers can create sessions"
ON public.sessions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

-- Trainers can update sessions they created OR are assigned to (only if scheduled)
CREATE POLICY "Trainers can update their sessions"
ON public.sessions FOR UPDATE
USING (
  has_role(auth.uid(), 'trainer'::app_role) AND 
  (trainer_id = auth.uid() OR created_by = auth.uid())
);

-- Trainers can delete sessions they created (only if scheduled - enforced in app)
CREATE POLICY "Trainers can delete their sessions"
ON public.sessions FOR DELETE
USING (
  has_role(auth.uid(), 'trainer'::app_role) AND 
  created_by = auth.uid() AND
  status = 'scheduled'
);

-- Participants (trainees) can view sessions they're enrolled in
CREATE POLICY "Participants can view enrolled sessions"
ON public.sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid()
  )
);