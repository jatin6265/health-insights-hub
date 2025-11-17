import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const insights = [
  {
    id: 1,
    title: "Improved Sleep Quality",
    description: "Your sleep pattern has improved by 15% this week. Maintain consistent bedtime.",
    priority: "high",
  },
  {
    id: 2,
    title: "Reduce Screen Time",
    description: "Screen time increased by 30 minutes. Consider a digital detox before bed.",
    priority: "medium",
  },
  {
    id: 3,
    title: "Stay Active",
    description: "Great job maintaining exercise routine! Keep up the 45-minute sessions.",
    priority: "low",
  },
];

export const InsightsPanel = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">AI Insights & Tips</h3>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-border"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground">{insight.title}</h4>
              <Badge
                variant={insight.priority === "high" ? "default" : "secondary"}
                className="text-xs"
              >
                {insight.priority}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{insight.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <p className="text-xs text-muted-foreground">
          💡 These insights are generated using AI analysis of your activity patterns, device data, 
          and behavioral trends to provide personalized health recommendations.
        </p>
      </div>
    </Card>
  );
};
