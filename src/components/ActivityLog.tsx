import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Phone, Smartphone } from "lucide-react";

const activities = [
  { id: 1, type: "Exercise", duration: "45 min", time: "2 hours ago", source: "Smartwatch", icon: Phone },
  { id: 2, type: "Screen Time", duration: "2.5 hrs", time: "Ongoing", source: "Phone", icon: Smartphone },
  { id: 3, type: "Sleep", duration: "7 hrs", time: "Last night", source: "Sleep Tracker", icon: Clock },
  { id: 4, type: "Location", duration: "Home", time: "Current", source: "GPS", icon: MapPin },
];

export const ActivityLog = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Activity Log</h3>
        <Badge variant="secondary">Real-time</Badge>
      </div>
      <div className="space-y-3">
        {activities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div
              key={activity.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{activity.type}</p>
                  <p className="text-sm text-muted-foreground">{activity.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{activity.duration}</p>
                <p className="text-xs text-muted-foreground">{activity.source}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
