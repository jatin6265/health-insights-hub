import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Settings } from "lucide-react";

const dataSourcesStatus = [
  { name: "Phone Activities", status: "active", lastSync: "Just now" },
  { name: "Smart Devices", status: "active", lastSync: "5 min ago" },
  { name: "Activity Logs", status: "active", lastSync: "1 min ago" },
  { name: "Location Data", status: "active", lastSync: "30 sec ago" },
  { name: "Health Sensors", status: "syncing", lastSync: "Syncing..." },
];

export const DataCollection = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Data Collection Status</h3>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Configure
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dataSourcesStatus.map((source) => (
          <div
            key={source.name}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex items-center gap-3">
              {source.status === "active" ? (
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              ) : (
                <Clock className="w-5 h-5 text-primary animate-pulse" />
              )}
              <div>
                <p className="font-medium text-foreground text-sm">{source.name}</p>
                <p className="text-xs text-muted-foreground">{source.lastSync}</p>
              </div>
            </div>
            <Badge variant={source.status === "active" ? "secondary" : "default"}>
              {source.status}
            </Badge>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-xs text-foreground">
          🔒 All data is encrypted and processed securely. Only you have access to your health information.
        </p>
      </div>
    </Card>
  );
};
