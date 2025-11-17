import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Settings, Smartphone } from "lucide-react";
import { useHealthData } from "@/hooks/useHealthData";

export const DataCollection = () => {
  const { dataSources, requestHealthPermissions, syncDataSource } = useHealthData();
  
  const hasActiveConnections = dataSources.some(source => source.permission);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Health Data Collection</h3>
        <Button variant="ghost" size="sm" onClick={() => syncDataSource(dataSources[0].name)}>
          <Settings className="w-4 h-4 mr-2" />
          Sync
        </Button>
      </div>

      {!hasActiveConnections && (
        <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-1">Connect Your Health Data</h4>
              <p className="text-sm text-muted-foreground mb-3">
                To receive personalized insights, we need access to your device's health data. 
                This includes sleep patterns, activity levels, and screen time.
              </p>
              <Button 
                onClick={requestHealthPermissions}
                className="bg-wellness-gradient"
              >
                Grant Health Access
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dataSources.map((source) => (
          <div
            key={source.name}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex items-center gap-3">
              {source.status === "active" ? (
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              ) : source.status === "syncing" ? (
                <Clock className="w-5 h-5 text-primary animate-pulse" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-foreground text-sm">{source.name}</p>
                <p className="text-xs text-muted-foreground">{source.lastSync}</p>
              </div>
            </div>
            <Badge variant={source.status === "active" ? "secondary" : "outline"}>
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
