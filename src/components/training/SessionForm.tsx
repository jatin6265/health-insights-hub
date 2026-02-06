import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Session, Training, UserProfile } from '@/types/auth';

const sessionSchema = z.object({
  training_id: z.string().min(1, 'Please select a training program'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().max(500).optional(),
  scheduled_date: z.string().min(1, 'Please select a date'),
  start_time: z.string().min(1, 'Please select a start time'),
  end_time: z.string().min(1, 'Please select an end time'),
  location: z.string().max(200).optional(),
  trainer_id: z.string().optional(),
  late_threshold_minutes: z.coerce.number().min(0).max(60).default(15),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface SessionFormProps {
  session?: Partial<Session> | null;
  onSubmit: (data: SessionFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SessionForm({ session, onSubmit, onCancel, isSubmitting }: SessionFormProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainers, setTrainers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      training_id: session?.training_id || '',
      title: session?.title || '',
      description: session?.description || '',
      scheduled_date: session?.scheduled_date || '',
      start_time: session?.start_time || '',
      end_time: session?.end_time || '',
      location: session?.location || '',
      trainer_id: session?.trainer_id || '',
      late_threshold_minutes: session?.late_threshold_minutes ?? 15,
    },
  });

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      // Fetch active trainings
      const { data: trainingsData } = await supabase
        .from('trainings')
        .select('*')
        .eq('is_active', true)
        .order('title');

      // Fetch trainers (users with trainer role)
      const { data: trainerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainer');

      const trainerIds = trainerRoles?.map(r => r.user_id) || [];

      const { data: trainersData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', trainerIds)
        .eq('status', 'active');

      setTrainings((trainingsData || []).map(t => ({
        ...t,
        is_active: t.is_active ?? true,
      })));
      setTrainers((trainersData || []).map(t => ({
        ...t,
        status: t.status as UserProfile['status'],
      })));
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading form...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="training_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Training Program</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a training program" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {trainings.map((training) => (
                    <SelectItem key={training.id} value={training.id}>
                      {training.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Session Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Module 1: Introduction" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Session objectives and agenda..."
                  className="min-h-[80px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="scheduled_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Room 101 or Zoom Link" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trainer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Trainer</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainer (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trainers.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id}>
                        {trainer.full_name || trainer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="late_threshold_minutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Late Threshold (minutes)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={60} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : session ? 'Update Session' : 'Create Session'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
