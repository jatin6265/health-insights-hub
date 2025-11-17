import { useState, useEffect } from "react";
import { Activity, Brain, Heart, TrendingUp, Zap, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HealthScore } from "@/components/HealthScore";
import { ActivityLog } from "@/components/ActivityLog";
import { InsightsPanel } from "@/components/InsightsPanel";
import { DataCollection } from "@/components/DataCollection";
import { toast } from "sonner";

const Index = () => {
  const [mentalHealthScore, setMentalHealthScore] = useState(72);
  const [physicalHealthScore, setPhysicalHealthScore] = useState(68);
  const [sensitivityLevel, setSensitivityLevel] = useState("Moderate");

  useEffect(() => {
    // Simulate data collection initialization
    toast.success("Health monitoring active", {
      description: "Data collection started successfully"
    });
  }, []);

  return (
    <div className="min-h-screen bg-calm-gradient">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-wellness-gradient flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MindBody Insights</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Health Tracking</p>
              </div>
            </div>
            <Button size="sm" className="bg-wellness-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Log Activity
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Health Scores Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HealthScore
            title="Mental Health"
            score={mentalHealthScore}
            icon={Brain}
            color="primary"
            trend="+5%"
          />
          <HealthScore
            title="Physical Health"
            score={physicalHealthScore}
            icon={Heart}
            color="secondary"
            trend="+3%"
          />
        </div>

        {/* Sensitivity Level */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Sensitivity Level</h3>
                <p className="text-sm text-muted-foreground">Current emotional state</p>
              </div>
            </div>
            <span className="text-lg font-bold text-accent">{sensitivityLevel}</span>
          </div>
          <Progress value={60} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Based on activity patterns and device data
          </p>
        </Card>

        {/* Data Collection Status */}
        <DataCollection />

        {/* Activity Log */}
        <ActivityLog />

        {/* AI Insights */}
        <InsightsPanel />

        {/* Daily Summary */}
        <Card className="p-6 bg-wellness-gradient text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Today's Summary</h3>
              <p className="text-white/90 text-sm leading-relaxed">
                Your mental health is trending positively with consistent activity patterns. 
                Consider taking a 10-minute meditation break to optimize your sensitivity levels.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Index;
