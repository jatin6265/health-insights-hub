-- 1) Allow trainers to read trainee roles (needed for participant assignment UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Trainers can view trainee roles'
  ) THEN
    EXECUTE 'CREATE POLICY "Trainers can view trainee roles"
    ON public.user_roles
    FOR SELECT
    USING (
      has_role(auth.uid(), ''trainer''::app_role)
      AND role = ''trainee''::app_role
    )';
  END IF;
END $$;

-- 2) Auto-create ABSENT attendance rows when a session is marked COMPLETED
--    (so reports/profile metrics include people who were assigned but never checked in)
CREATE OR REPLACE FUNCTION public.auto_mark_absent_on_session_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.attendance (session_id, user_id, status)
    SELECT sp.session_id, sp.user_id, 'absent'::attendance_status
    FROM public.session_participants sp
    WHERE sp.session_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.attendance a
        WHERE a.session_id = NEW.id
          AND a.user_id = sp.user_id
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_absent_on_complete ON public.sessions;
CREATE TRIGGER trg_auto_absent_on_complete
AFTER UPDATE OF status ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.auto_mark_absent_on_session_complete();