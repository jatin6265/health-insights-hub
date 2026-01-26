import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tags, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface CategoryAssignmentProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function CategoryAssignment({
  userId,
  userName,
  isOpen,
  onClose,
  onUpdated,
}: CategoryAssignmentProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignedCategoryIds, setAssignedCategoryIds] = useState<Set<string>>(new Set());
  const [originalAssigned, setOriginalAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all categories
      const { data: categoriesData, error: catError } = await supabase
        .from('trainee_categories')
        .select('*')
        .order('name');

      if (catError) throw catError;

      // Fetch user's current category assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('user_categories')
        .select('category_id')
        .eq('user_id', userId);

      if (assignError) throw assignError;

      setCategories(categoriesData || []);
      const assigned = new Set(assignmentsData?.map(a => a.category_id) || []);
      setAssignedCategoryIds(assigned);
      setOriginalAssigned(new Set(assigned));
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setAssignedCategoryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Find categories to add and remove
      const toAdd = [...assignedCategoryIds].filter(id => !originalAssigned.has(id));
      const toRemove = [...originalAssigned].filter(id => !assignedCategoryIds.has(id));

      // Remove unassigned categories
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_categories')
          .delete()
          .eq('user_id', userId)
          .in('category_id', toRemove);

        if (deleteError) throw deleteError;
      }

      // Add new categories
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('user_categories')
          .insert(
            toAdd.map(categoryId => ({
              user_id: userId,
              category_id: categoryId,
              assigned_by: user.id,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success('Category assignments updated');
      onUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error saving categories:', error);
      toast.error('Failed to update category assignments');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (assignedCategoryIds.size !== originalAssigned.size) return true;
    for (const id of assignedCategoryIds) {
      if (!originalAssigned.has(id)) return true;
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="w-5 h-5" />
            Assign Categories
          </DialogTitle>
          <DialogDescription>
            Manage category assignments for {userName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tags className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No categories available</p>
            <p className="text-sm mt-1">Create categories from the Training page</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={assignedCategoryIds.has(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color || '#6366f1' }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Current Assignments */}
        {assignedCategoryIds.size > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-2">Selected categories:</p>
            <div className="flex flex-wrap gap-1">
              {[...assignedCategoryIds].map(id => {
                const cat = categories.find(c => c.id === id);
                if (!cat) return null;
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="gap-1"
                    style={{ 
                      backgroundColor: `${cat.color}20`,
                      borderColor: cat.color || undefined 
                    }}
                  >
                    {cat.name}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(id);
                      }}
                    />
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
