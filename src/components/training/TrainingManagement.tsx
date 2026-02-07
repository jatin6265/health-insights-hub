import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  MobileCardList,
  MobileCardItem,
  MobileCardHeader,
  MobileCardBody,
  MobileCardRow,
  MobileCardActions,
} from '@/components/ui/mobile-card-list';
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
  const isMobile = useIsMobile();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [deletingTraining, setDeletingTraining] = useState<Training | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter trainings based on search
  const filteredTrainings = useMemo(() => {
    if (!searchTerm.trim()) return trainings;
    const term = searchTerm.toLowerCase();
    return trainings.filter(t =>
      t.title.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term)
    );
  }, [trainings, searchTerm]);

  // Pagination
  const pagination = usePagination(filteredTrainings, { initialPageSize: 10 });

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

  const formatDateRange = (training: Training) => {
    if (training.start_date && training.end_date) {
      return `${new Date(training.start_date).toLocaleDateString()} - ${new Date(training.end_date).toLocaleDateString()}`;
    } else if (training.start_date) {
      return `From ${new Date(training.start_date).toLocaleDateString()}`;
    }
    return 'No dates set';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading trainings...</div>
      </div>
    );
  }

  const renderTrainingActions = (training: Training) => (
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
  );

  return (
    <Card className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Training Programs</h2>
        </div>
        <Button onClick={openCreateForm} className="w-full sm:w-auto">
          <PlusCircle className="w-4 h-4 mr-2" />
          New Training
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search trainings..."
          containerClassName="max-w-md"
        />
      </div>

      {filteredTrainings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {searchTerm ? (
            <p>No trainings found matching "{searchTerm}"</p>
          ) : (
            <>
              <p>No training programs yet</p>
              <Button variant="link" onClick={openCreateForm}>
                Create your first training program
              </Button>
            </>
          )}
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <MobileCardList>
          {pagination.paginatedData.map((training) => (
            <MobileCardItem key={training.id}>
              <MobileCardHeader
                title={training.title}
                subtitle={training.description}
                badge={
                  <Badge variant={training.is_active ? 'default' : 'secondary'}>
                    {training.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                }
                actions={renderTrainingActions(training)}
              />
              <MobileCardBody>
                <MobileCardRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Duration"
                  value={formatDateRange(training)}
                />
                <MobileCardRow
                  label="Created"
                  value={new Date(training.created_at).toLocaleDateString()}
                />
              </MobileCardBody>
            </MobileCardItem>
          ))}
        </MobileCardList>
      ) : (
        /* Desktop Table View */
        <div className="overflow-x-auto">
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
              {pagination.paginatedData.map((training) => (
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
                      <span>{formatDateRange(training)}</span>
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
                    {renderTrainingActions(training)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <DataTablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrev={pagination.canGoPrev}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
