-- Add attendance_type column for timing classification (on_time, late, partial)
-- This is SEPARATE from attendance status which tracks presence confirmation

-- Create the attendance_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE attendance_type AS ENUM ('on_time', 'late', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add attendance_type column to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS attendance_type attendance_type DEFAULT NULL;

-- Add partial_threshold_minutes to sessions table (for partial classification)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS partial_threshold_minutes integer DEFAULT 30;

-- Add index for faster lookups on attendance type
CREATE INDEX IF NOT EXISTS idx_attendance_type ON public.attendance (attendance_type);

-- Update existing attendance records to classify them based on join_time
-- This will set attendance_type for existing records with present/late status
UPDATE public.attendance a
SET attendance_type = 
  CASE 
    WHEN a.status = 'present' THEN 'on_time'::attendance_type
    WHEN a.status = 'late' THEN 'late'::attendance_type
    WHEN a.status = 'partial' THEN 'partial'::attendance_type
    ELSE NULL
  END
WHERE a.attendance_type IS NULL AND a.status IN ('present', 'late', 'partial');

-- Add delete policy for notifications table so read notifications can be deleted
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());