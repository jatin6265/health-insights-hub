import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthScoreProps {
  title: string;
  score: number;
  icon: LucideIcon;
  color: "primary" | "secondary" | "accent";
  trend: string;
}

export const HealthScore = ({ title, score, icon: Icon, color, trend }: HealthScoreProps) => {
  const colorClasses = {
    primary: "text-primary bg-primary/10",
    secondary: "text-secondary bg-secondary/10",
    accent: "text-accent bg-accent/10",
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", colorClasses[color])}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">Current status</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">{score}</div>
          <div className="text-sm text-secondary font-medium">{trend}</div>
        </div>
      </div>
      <Progress value={score} className="h-2" />
      <div className="mt-3 text-xs text-muted-foreground">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </Card>
  );
};
