import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionAutoComplete } from "@/hooks/useSessionAutoComplete";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { TrainerDashboard } from "@/components/dashboards/TrainerDashboard";
import { TraineeDashboard } from "@/components/dashboards/TraineeDashboard";
import { PendingApproval } from "@/components/dashboards/PendingApproval";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, GraduationCap, Users } from "lucide-react";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading, role, isActive, isPending, signOut, profile, isAdmin, isTrainer } = useAuth();
  
  // Auto-complete sessions check every 30 seconds (only for admins/trainers)
  useSessionAutoComplete((isAdmin || isTrainer) ? 30000 : 0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show pending approval screen
  if (isPending) {
    return <PendingApproval />;
  }

  const getRoleIcon = () => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5" />;
      case 'trainer':
        return <GraduationCap className="w-5 h-5" />;
      default:
        return <Users className="w-5 h-5" />;
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'trainer':
        return 'Trainer';
      default:
        return 'Trainee';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                {getRoleIcon()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">QR Attendance System</h1>
                <p className="text-sm text-muted-foreground">{getRoleLabel()} Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationInbox />
              <Button size="sm" variant="ghost" onClick={() => navigate('/profile')}>
                <User className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-foreground">
            Welcome back, <strong>{profile?.full_name || 'User'}</strong>!
          </p>
        </div>

        {/* Role-based Dashboard */}
        {role === 'admin' && <AdminDashboard />}
        {role === 'trainer' && <TrainerDashboard />}
        {role === 'trainee' && <TraineeDashboard />}
        {!role && <TraineeDashboard />}
      </main>
    </div>
  );
};

export default Index;
