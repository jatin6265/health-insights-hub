import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Tag,
  Plus,
  Trash2,
  Edit,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  title: string;
  scheduled_date: string;
  training_title: string;
  start_time: string;
}

interface Participant {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  assigned_at: string;
  attendance_status?: 'present' | 'late' | 'absent' | null;
  join_time?: string | null;
}

interface AvailableUser {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  categories: string[];
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  user_count?: number;
}

export function ParticipantManagement() {
  const { user, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [activeTab, setActiveTab] = useState('individual');
  
  // Category management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchParticipants();
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, scheduled_date, start_time, trainings(title)')
        .in('status', ['scheduled', 'active'])
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        training_title: (s.trainings as { title: string })?.title || 'Unknown',
      }));

      setSessions(mapped);
      if (mapped.length > 0 && !selectedSession) {
        setSelectedSession(mapped[0].id);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: categoriesData, error } = await supabase
        .from('trainee_categories')
        .select('id, name, description, color')
        .order('name');

      if (error) throw error;

      // Get user counts for each category
      const { data: userCategoryData } = await supabase
        .from('user_categories')
        .select('category_id');

      const countMap = new Map<string, number>();
      userCategoryData?.forEach(uc => {
        countMap.set(uc.category_id, (countMap.get(uc.category_id) || 0) + 1);
      });

      const mappedCategories: Category[] = (categoriesData || []).map(c => ({
        ...c,
        user_count: countMap.get(c.id) || 0,
      }));

      setCategories(mappedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchParticipants = async () => {
    if (!selectedSession) return;

    try {
      const { data: participantsData, error } = await supabase
        .from('session_participants')
        .select('id, user_id, assigned_at')
        .eq('session_id', selectedSession);

      if (error) throw error;

      const userIds = participantsData?.map(p => p.user_id) || [];

      if (userIds.length === 0) {
        setParticipants([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .in('id', userIds);

      const { data: attendance } = await supabase
        .from('attendance')
        .select('user_id, status, join_time')
        .eq('session_id', selectedSession);

      const attendanceMap = new Map(attendance?.map(a => [a.user_id, { status: a.status as 'present' | 'late' | 'absent', join_time: a.join_time }]));
      const profilesMap = new Map(profiles?.map(p => [p.id, p]));

      const mapped: Participant[] = (participantsData || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: profilesMap.get(p.user_id)?.full_name || 'Unknown',
        email: profilesMap.get(p.user_id)?.email || '',
        department: profilesMap.get(p.user_id)?.department || null,
        assigned_at: p.assigned_at,
        attendance_status: attendanceMap.get(p.user_id)?.status || null,
        join_time: attendanceMap.get(p.user_id)?.join_time || null,
      }));

      setParticipants(mapped);
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast.error('Failed to load participants');
    }
  };

  const fetchAvailableUsers = async () => {
    if (!selectedSession) return;

    try {
      // Get all active trainees
      const { data: trainees, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainee');

      if (rolesError) throw rolesError;

      const traineeIds = trainees?.map(t => t.user_id) || [];

      if (traineeIds.length === 0) {
        setAvailableUsers([]);
        return;
      }

      // Get active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('status', 'active')
        .in('id', traineeIds);

      if (profilesError) throw profilesError;

      // Get user categories
      const { data: userCats } = await supabase
        .from('user_categories')
        .select('user_id, category_id, trainee_categories(name)')
        .in('user_id', traineeIds);

      const userCategoryMap = new Map<string, string[]>();
      userCats?.forEach(uc => {
        const cats = userCategoryMap.get(uc.user_id) || [];
        if (uc.trainee_categories) {
          cats.push((uc.trainee_categories as { name: string }).name);
        }
        userCategoryMap.set(uc.user_id, cats);
      });

      // Filter out already assigned participants
      const assignedIds = new Set(participants.map(p => p.user_id));
      const available: AvailableUser[] = (profiles || [])
        .filter(p => !assignedIds.has(p.id))
        .map(p => ({
          ...p,
          categories: userCategoryMap.get(p.id) || [],
        }));

      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching available users:', error);
      toast.error('Failed to load available users');
    }
  };

  const openAddDialog = () => {
    fetchAvailableUsers();
    setSelectedUsers(new Set());
    setSelectedCategory('');
    setSearchTerm('');
    setActiveTab('individual');
    setIsAddDialogOpen(true);
  };

  const handleAddParticipants = async () => {
    if (selectedUsers.size === 0 || !selectedSession || !user) return;

    setAddingParticipants(true);
    try {
      const userIdsArray = Array.from(selectedUsers);
      const inserts = userIdsArray.map(userId => ({
        session_id: selectedSession,
        user_id: userId,
        assigned_by: user.id,
      }));

      const { error } = await supabase
        .from('session_participants')
        .insert(inserts);

      if (error) throw error;

      // Send notification
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'session_assigned',
            sessionId: selectedSession,
            userIds: userIdsArray,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send assignment notifications:', notifyError);
      }

      toast.success(`Added ${selectedUsers.size} participant(s) successfully`);
      setIsAddDialogOpen(false);
      fetchParticipants();
    } catch (error) {
      console.error('Error adding participants:', error);
      toast.error('Failed to add participants');
    } finally {
      setAddingParticipants(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string, userName: string) => {
    try {
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast.success(`Removed ${userName} from session`);
      fetchParticipants();
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant');
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllFiltered = () => {
    const filtered = getFilteredUsers();
    if (selectedUsers.size === filtered.length && filtered.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map(u => u.id)));
    }
  };

  const selectByCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    if (categoryName === 'all') {
      // Select all available trainees
      setSelectedUsers(new Set(availableUsers.map(u => u.id)));
    } else if (categoryName) {
      // Select users in the category
      const usersInCategory = availableUsers.filter(u => 
        u.categories.includes(categoryName)
      );
      setSelectedUsers(new Set(usersInCategory.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const getFilteredUsers = () => {
    return availableUsers.filter(u =>
      (u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  // Category Management
  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('trainee_categories')
          .update({
            name: newCategoryName,
            description: newCategoryDescription,
            color: newCategoryColor,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated successfully');
      } else {
        const { error } = await supabase
          .from('trainee_categories')
          .insert({
            name: newCategoryName,
            description: newCategoryDescription,
            color: newCategoryColor,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success('Category created successfully');
      }

      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryColor('#6366f1');
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Failed to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('trainee_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
    setNewCategoryColor(category.color);
    setIsCategoryDialogOpen(true);
  };

  // CSV Export
  const exportToCSV = () => {
    if (participants.length === 0) {
      toast.error('No participants to export');
      return;
    }

    const currentSession = sessions.find(s => s.id === selectedSession);
    const headers = ['Name', 'Email', 'Department', 'Assigned Date', 'Attendance Status', 'Join Time'];
    
    const rows = participants.map(p => [
      p.full_name,
      p.email,
      p.department || 'N/A',
      new Date(p.assigned_at).toLocaleDateString(),
      p.attendance_status || 'Not Marked',
      p.join_time ? new Date(p.join_time).toLocaleString() : 'N/A',
    ]);

    const csvContent = [
      `Session: ${currentSession?.title || 'Unknown'}`,
      `Date: ${currentSession?.scheduled_date || 'Unknown'}`,
      `Training: ${currentSession?.training_title || 'Unknown'}`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${currentSession?.title?.replace(/\s+/g, '_')}_${currentSession?.scheduled_date}.csv`;
    link.click();
    
    toast.success('Attendance exported to CSV');
  };

  const getAttendanceBadge = (status: 'present' | 'late' | 'absent' | null) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Present</Badge>;
      case 'late':
        return <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" /> Late</Badge>;
      case 'absent':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Absent</Badge>;
      default:
        return <Badge variant="outline">Not Marked</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === selectedSession);
  const filteredUsers = getFilteredUsers();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Participant Management</h2>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} - {new Date(s.scheduled_date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={participants.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={openAddDialog} disabled={!selectedSession}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Participants
          </Button>
        </div>
      </div>

      {currentSession && (
        <div className="mb-4 p-3 bg-muted rounded-lg flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {currentSession.training_title} • {new Date(currentSession.scheduled_date).toLocaleDateString()} at {currentSession.start_time}
          </span>
          <Badge variant="secondary">{participants.length} participants</Badge>
        </div>
      )}

      {!selectedSession ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a session to manage participants</p>
        </div>
      ) : participants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No participants assigned to this session</p>
          <Button variant="link" onClick={openAddDialog}>
            Add your first participant
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Join Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell className="text-muted-foreground">{p.department || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.assigned_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{getAttendanceBadge(p.attendance_status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.join_time ? new Date(p.join_time).toLocaleTimeString() : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveParticipant(p.id, p.full_name)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Participants Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Participants</DialogTitle>
            <DialogDescription>
              Select trainees individually or by category
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Individual Selection</TabsTrigger>
              <TabsTrigger value="category">By Category</TabsTrigger>
            </TabsList>

            <TabsContent value="category" className="space-y-4">
              <div className="space-y-2">
                <Label>Select Category</Label>
                <Select value={selectedCategory} onValueChange={selectByCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        All Available Trainees ({availableUsers.length})
                      </div>
                    </SelectItem>
                    {categories.map(cat => {
                      const usersInCat = availableUsers.filter(u => u.categories.includes(cat.name)).length;
                      return (
                        <SelectItem key={cat.id} value={cat.name}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name} ({usersInCat} available)
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedUsers.size} trainee(s) will be added:
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {Array.from(selectedUsers).slice(0, 10).map(userId => {
                      const user = availableUsers.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary">
                          {user?.full_name || 'Unknown'}
                        </Badge>
                      );
                    })}
                    {selectedUsers.size > 10 && (
                      <Badge variant="outline">+{selectedUsers.size - 10} more</Badge>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="individual" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  {availableUsers.length === 0 
                    ? 'No available trainees to add'
                    : 'No trainees match your search'
                  }
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedUsers.size} of {filteredUsers.length} selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                      {selectedUsers.size === filteredUsers.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    {filteredUsers.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        onClick={() => toggleUserSelection(u.id)}
                      >
                        <Checkbox
                          checked={selectedUsers.has(u.id)}
                          onCheckedChange={() => toggleUserSelection(u.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{u.full_name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                          {u.department && (
                            <p className="text-xs text-muted-foreground">{u.department}</p>
                          )}
                        </div>
                        {u.categories.length > 0 && (
                          <div className="flex gap-1">
                            {u.categories.slice(0, 2).map(cat => (
                              <Badge key={cat} variant="outline" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddParticipants} 
              disabled={selectedUsers.size === 0 || addingParticipants}
            >
              {addingParticipants ? 'Adding...' : `Add ${selectedUsers.size} Participant(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
        setIsCategoryDialogOpen(open);
        if (!open) {
          setEditingCategory(null);
          setNewCategoryName('');
          setNewCategoryDescription('');
          setNewCategoryColor('#6366f1');
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create and manage trainee categories for quick assignment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Create/Edit Category Form */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium text-sm">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h4>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="cat-name">Name</Label>
                  <Input
                    id="cat-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Senior Trainees"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-desc">Description (optional)</Label>
                  <Input
                    id="cat-desc"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    placeholder="e.g., Trainees with 1+ year experience"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cat-color"
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveCategory} disabled={savingCategory} size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  {savingCategory ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                </Button>
                {editingCategory && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategoryName('');
                      setNewCategoryDescription('');
                      setNewCategoryColor('#6366f1');
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Category List */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Existing Categories</h4>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No categories created yet
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        <div>
                          <p className="font-medium text-sm">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {cat.user_count} users
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => editCategory(cat)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
