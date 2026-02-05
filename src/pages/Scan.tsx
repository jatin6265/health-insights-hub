import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, QrCode } from "lucide-react";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function ScanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<ScanState>({ status: "idle" });

  const token = params.get("token") ?? "";
  const sessionId = params.get("session") ?? "";

  const isValid = useMemo(() => Boolean(token && sessionId), [token, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isValid) {
        setState({ status: "error", message: "Invalid QR link." });
        return;
      }

      setState({ status: "loading" });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // User must be logged in; send to auth and let them come back.
        navigate("/auth", { replace: true });
        return;
      }

      const res = await supabase.functions.invoke("mark-attendance", {
        body: { token, sessionId },
      });

      if (cancelled) return;

      if (res.error) {
        setState({ status: "error", message: res.error.message || "Failed to mark attendance." });
        return;
      }

      const result = res.data as { success?: boolean; message?: string };
      if (result?.success) {
        setState({ status: "success", message: result.message || "Attendance marked." });
      } else {
        setState({ status: "error", message: result?.message || "Failed to mark attendance." });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isValid, navigate, sessionId, token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">QR Attendance</h1>
            <p className="text-sm text-muted-foreground">Confirming your presence…</p>
          </div>
        </div>

        {state.status === "loading" || state.status === "idle" ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Marking attendance…</span>
          </div>
        ) : state.status === "success" ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Success</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Couldn’t mark attendance</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => navigate("/")}>Go to Dashboard</Button>
          <Button className="flex-1" variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
