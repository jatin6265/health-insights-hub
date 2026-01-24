-- Create trainee categories table for dynamic category management
CREATE TABLE public.trainee_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for user-category assignments
CREATE TABLE public.user_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.trainee_categories(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE(user_id, category_id)
);

-- Enable RLS
ALTER TABLE public.trainee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for trainee_categories
CREATE POLICY "Admins can manage categories" ON public.trainee_categories
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trainers can view and create categories" ON public.trainee_categories
FOR SELECT USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can insert categories" ON public.trainee_categories
FOR INSERT WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update their categories" ON public.trainee_categories
FOR UPDATE USING (has_role(auth.uid(), 'trainer'::app_role) AND created_by = auth.uid());

-- RLS policies for user_categories
CREATE POLICY "Admins and trainers can manage user categories" ON public.user_categories
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Users can view their own categories" ON public.user_categories
FOR SELECT USING (user_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_trainee_categories_updated_at
BEFORE UPDATE ON public.trainee_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.trainee_categories (name, description, color) VALUES
('All Trainees', 'All active trainees in the system', '#22c55e'),
('Beginners', 'New trainees just starting their training', '#3b82f6'),
('Intermediate', 'Trainees with some experience', '#f59e0b'),
('Advanced', 'Experienced trainees', '#8b5cf6');