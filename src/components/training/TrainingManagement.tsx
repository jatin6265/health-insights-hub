import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GraduationCap,
  PlusCircle,
  Pencil,
  Trash2,
  Calendar,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Training } from '@/types/auth';
import { TrainingForm } from './TrainingForm';

export function TrainingManagement() {
  const { user, isAdmin } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [deletingTraining, setDeletingTraining] = useState<Training | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTrainings((data || []).map(t => ({
        ...t,
        is_active: t.is_active ?? true,
      })));
    } catch (error) {
      console.error('Error fetching trainings:', error);
      toast.error('Failed to load trainings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTraining = async (data: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    is_active: boolean;
  }) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('trainings').insert({
        title: data.title,
        description: data.description || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        is_active: data.is_active,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success('Training program created successfully');
      setIsFormOpen(false);
      fetchTrainings();
    } catch (error) {
      console.error('Error creating training:', error);
      toast.error('Failed to create training');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTraining = async (data: {
    title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    is_active: boolean;
  }) => {
    if (!editingTraining) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('trainings')
        .update({
          title: data.title,
          description: data.description || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          is_active: data.is_active,
        })
        .eq('id', editingTraining.id);

      if (error) throw error;

      toast.success('Training program updated successfully');
      setEditingTraining(null);
      setIsFormOpen(false);
      fetchTrainings();
    } catch (error) {
      console.error('Error updating training:', error);
      toast.error('Failed to update training');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTraining = async () => {
    if (!deletingTraining) return;

    try {
      const { error } = await supabase
        .from('trainings')
        .delete()
        .eq('id', deletingTraining.id);

      if (error) throw error;

      toast.success('Training program deleted successfully');
      setDeletingTraining(null);
      fetchTrainings();
    } catch (error) {
      console.error('Error deleting training:', error);
      toast.error('Failed to delete training. It may have associated sessions.');
    }
  };

  const openEditForm = (training: Training) => {
    setEditingTraining(training);
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingTraining(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingTraining(null);
    setIsFormOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading trainings...</div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Training Programs</h2>
        </div>
        <Button onClick={openCreateForm}>
          <PlusCircle className="w-4 h-4 mr-2" />
          New Training
        </Button>
      </div>

      {trainings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No training programs yet</p>
          <Button variant="link" onClick={openCreateForm}>
            Create your first training program
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainings.map((training) => (
              <TableRow key={training.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{training.title}</p>
                    {training.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {training.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {training.start_date && training.end_date ? (
                      <span>
                        {new Date(training.start_date).toLocaleDateString()} - {new Date(training.end_date).toLocaleDateString()}
                      </span>
                    ) : training.start_date ? (
                      <span>From {new Date(training.start_date).toLocaleDateString()}</span>
                    ) : (
                      <span>No dates set</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={training.is_active ? 'default' : 'secondary'}>
                    {training.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(training.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditForm(training)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {/* Only admins can delete training programs */}
                      {isAdmin && (
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeletingTraining(training)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTraining ? 'Edit Training Program' : 'Create Training Program'}
            </DialogTitle>
          </DialogHeader>
          <TrainingForm
            training={editingTraining}
            onSubmit={editingTraining ? handleUpdateTraining : handleCreateTraining}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTraining} onOpenChange={() => setDeletingTraining(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingTraining?.title}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTraining}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
