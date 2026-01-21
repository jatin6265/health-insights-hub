-- Allow trainers to view profiles of participants in their sessions
CREATE POLICY "Trainers can view participant profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'trainer'::app_role) AND
  EXISTS (
    SELECT 1 FROM session_participants sp
    JOIN sessions s ON sp.session_id = s.id
    WHERE sp.user_id = profiles.id
    AND s.trainer_id = auth.uid()
  )
);

-- Allow trainers to view profiles of all trainees (for participant management)
CREATE POLICY "Trainers can view trainee profiles for assignment" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'trainer'::app_role) AND
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = profiles.id
    AND ur.role = 'trainee'
  )
);