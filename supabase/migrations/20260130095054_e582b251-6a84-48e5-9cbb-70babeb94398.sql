
-- Create join_requests table to track attendance requests
CREATE TABLE public.join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  notes TEXT,
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- Trainees can view their own requests
CREATE POLICY "Trainees can view their own join requests"
ON public.join_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Trainees can create join requests for sessions they're assigned to
CREATE POLICY "Trainees can create join requests for assigned sessions"
ON public.join_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = join_requests.session_id
    AND sp.user_id = auth.uid()
  )
);

-- Trainers can view requests for their sessions
CREATE POLICY "Trainers can view join requests for their sessions"
ON public.join_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = join_requests.session_id
    AND s.trainer_id = auth.uid()
  )
);

-- Trainers can update requests for their sessions
CREATE POLICY "Trainers can update join requests for their sessions"
ON public.join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = join_requests.session_id
    AND s.trainer_id = auth.uid()
  )
);

-- Admins can view all join requests
CREATE POLICY "Admins can view all join requests"
ON public.join_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all join requests
CREATE POLICY "Admins can manage all join requests"
ON public.join_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for join_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
