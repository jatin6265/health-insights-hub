import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function PendingApproval() {
  const { signOut, refreshUserData, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Account Pending Approval</h1>
          <p className="text-muted-foreground">
            Your account is awaiting approval from an administrator.
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Name:</strong> {profile?.full_name || 'N/A'}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Email:</strong> {profile?.email || 'N/A'}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Registered:</strong>{' '}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          You will receive a notification once your account has been approved.
          You can then access the system with your assigned role.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={refreshUserData} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Status
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
