import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrainingManagement } from '@/components/training/TrainingManagement';
import { SessionManagement } from '@/components/training/SessionManagement';
import { GraduationCap, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Training() {
  const { user, loading, isAdmin, isTrainer } = useAuth();

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

  if (!isAdmin && !isTrainer) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Training Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage training programs and sessions
          </p>
        </div>

        <Tabs defaultValue="trainings" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="trainings" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Programs
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trainings">
            <TrainingManagement />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
