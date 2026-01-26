-- Fix the sessions RLS policy - the condition was referencing the wrong column
DROP POLICY IF EXISTS "Participants can view their sessions" ON public.sessions;

CREATE POLICY "Participants can view their sessions" 
ON public.sessions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (trainer_id = auth.uid()) 
  OR EXISTS (
    SELECT 1
    FROM session_participants sp
    WHERE sp.session_id = sessions.id 
      AND sp.user_id = auth.uid()
  )
);