import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePagination } from '@/hooks/usePagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, UserCog, Shield, Users, UserCheck, UserX, Mail, Phone, Building, KeyRound, Trash2, Loader2, Tags, MoreVertical, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { AppRole, UserStatus, UserWithRole } from '@/types/auth';
import { PasswordStrengthIndicator, validatePasswordStrength } from '@/components/auth/PasswordStrengthIndicator';
import { CategoryAssignment } from '@/components/user/CategoryAssignment';

export default function UserManagement() {
  const { user, loading, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>('trainee');
  const [newStatus, setNewStatus] = useState<UserStatus>('pending');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [categoryUser, setCategoryUser] = useState<UserWithRole | null>(null);

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.department?.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === statusFilter);
    }

    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pagination
  const pagination = usePagination(filteredUsers, { initialPageSize: 10 });

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoadingUsers(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    const usersWithRoles = (profiles || []).map(profile => ({
      ...profile,
      role: roles?.find(r => r.user_id === profile.id)?.role as AppRole | undefined
    }));

    setUsers(usersWithRoles);
    setLoadingUsers(false);
  };

  const handleEditUser = (u: UserWithRole) => {
    setSelectedUser(u);
    setNewRole(u.role || 'trainee');
    setNewStatus(u.status);
    setShowEditDialog(true);
  };

  const handleResetPassword = (u: UserWithRole) => {
    setSelectedUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordDialog(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setUpdating(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        status: newStatus,
        approved_at: newStatus === 'active' ? new Date().toISOString() : null,
        approved_by: newStatus === 'active' ? user?.id : null
      })
      .eq('id', selectedUser.id);

    if (profileError) {
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive'
      });
      setUpdating(false);
      return;
    }

    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', selectedUser.id)
      .single();

    if (existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUser.id);

      if (roleError) {
        toast({
          title: 'Error',
          description: 'Failed to update user role',
          variant: 'destructive'
        });
        setUpdating(false);
        return;
      }
    } else {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUser.id, role: newRole });

      if (roleError) {
        toast({
          title: 'Error',
          description: 'Failed to assign user role',
          variant: 'destructive'
        });
        setUpdating(false);
        return;
      }
    }

    toast({
      title: 'Success',
      description: 'User updated successfully'
    });
    setShowEditDialog(false);
    setSelectedUser(null);
    setUpdating(false);
    fetchUsers();
  };

  const handleSubmitPasswordReset = async () => {
    if (!selectedUser) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (!validatePasswordStrength(newPassword)) {
      toast({
        title: 'Error',
        description: 'Password is too weak. Please use a stronger password.',
        variant: 'destructive'
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: selectedUser.id, newPassword },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Success',
        description: 'Password has been reset successfully'
      });
      setShowPasswordDialog(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userToDelete: UserWithRole) => {
    setDeletingUser(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Success',
        description: 'User has been permanently deleted'
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive'
      });
    } finally {
      setDeletingUser(false);
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-secondary text-secondary-foreground">Active</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role?: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
      case 'trainer':
        return <Badge className="bg-accent text-accent-foreground">Trainer</Badge>;
      case 'trainee':
        return <Badge variant="outline">Trainee</Badge>;
      default:
        return <Badge variant="outline">No Role</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    admins: users.filter(u => u.role === 'admin').length,
    trainers: users.filter(u => u.role === 'trainer').length,
    trainees: users.filter(u => u.role === 'trainee').length
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const renderUserActions = (u: UserWithRole) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditUser(u)}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        {u.role === 'trainee' && (
          <DropdownMenuItem onClick={() => setCategoryUser(u)}>
            <Tags className="w-4 h-4 mr-2" />
            Categories
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => handleResetPassword(u)}>
          <KeyRound className="w-4 h-4 mr-2" />
          Reset Password
        </DropdownMenuItem>
        {u.id !== user?.id && (
          <DropdownMenuItem 
            className="text-destructive"
            onClick={() => handleDeleteUser(u)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <UserCog className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-secondary" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Admins</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.admins}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-accent" />
                <span className="text-sm text-muted-foreground">Trainers</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.trainers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Trainees</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.trainees}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col gap-4">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by name, email, or department..."
                containerClassName="w-full"
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="trainee">Trainee</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Click on a user to edit their role and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' ? (
                  <p>No users found matching your criteria</p>
                ) : (
                  <p>No users found</p>
                )}
              </div>
            ) : isMobile ? (
              /* Mobile Card View */
              <MobileCardList>
                {pagination.paginatedData.map((u) => (
                  <MobileCardItem key={u.id}>
                    <MobileCardHeader
                      title={
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(u.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{u.full_name || 'Unnamed'}</span>
                        </div>
                      }
                      actions={renderUserActions(u)}
                    />
                    <MobileCardBody>
                      {u.email && (
                        <MobileCardRow
                          icon={<Mail className="w-4 h-4" />}
                          label="Email"
                          value={u.email}
                        />
                      )}
                      {u.department && (
                        <MobileCardRow
                          icon={<Building className="w-4 h-4" />}
                          label="Dept"
                          value={u.department}
                        />
                      )}
                      <MobileCardRow
                        label="Role"
                        value={getRoleBadge(u.role)}
                      />
                      <MobileCardRow
                        label="Status"
                        value={getStatusBadge(u.status)}
                      />
                      <MobileCardRow
                        label="Joined"
                        value={new Date(u.created_at).toLocaleDateString()}
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
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(u.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{u.full_name || 'Unnamed'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {u.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {u.email}
                              </div>
                            )}
                            {u.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {u.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.department ? (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-muted-foreground" />
                              {u.department}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getRoleBadge(u.role)}</TableCell>
                        <TableCell>{getStatusBadge(u.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {renderUserActions(u)}
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
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update role and status for {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(value: AppRole) => setNewRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="trainee">Trainee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={(value: UserStatus) => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={updating}>
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords don't match</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitPasswordReset} 
                disabled={resettingPassword || !newPassword || newPassword !== confirmPassword}
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Assignment Dialog */}
        {categoryUser && (
          <CategoryAssignment
            userId={categoryUser.id}
            userName={categoryUser.full_name || categoryUser.email || 'User'}
            isOpen={!!categoryUser}
            onClose={() => setCategoryUser(null)}
            onUpdated={fetchUsers}
          />
        )}
      </div>
    </div>
  );
}
