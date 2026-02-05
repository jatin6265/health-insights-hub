import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

type AttendanceType = "on_time" | "late" | "partial";

type ManualStatus = "present" | "late" | "partial" | "absent";

function mapManualStatus(status: ManualStatus): {
  attendanceStatus: "present" | "absent";
  attendanceType: AttendanceType | null;
} {
  if (status === "absent") {
    return { attendanceStatus: "absent", attendanceType: null };
  }
  if (status === "late" || status === "partial") {
    return { attendanceStatus: "present", attendanceType: status };
  }
  return { attendanceStatus: "present", attendanceType: "on_time" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const debugId = crypto.randomUUID();
  console.log(`[${debugId}] set-attendance: received`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        {
          success: false,
          reason: "NOT_AUTHENTICATED",
          message: "Please log in.",
          debugId,
        },
        401
      );
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId ?? body.session_id;
    const userId = body.userId ?? body.user_id;
    const status = body.status as ManualStatus | undefined;

    if (!sessionId || !userId || !status) {
      return jsonResponse(
        {
          success: false,
          reason: "INVALID_PAYLOAD",
          message: "Missing sessionId, userId, or status.",
          debugId,
        },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error(`[${debugId}] Missing env vars`);
      return jsonResponse(
        {
          success: false,
          reason: "SERVER_CONFIG_ERROR",
          message: "Server misconfiguration.",
          debugId,
        },
        500
      );
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          reason: "INVALID_SESSION",
          message: "Authentication failed.",
          debugId,
        },
        401
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = roleRow?.role as string | undefined;
    const isAdmin = role === "admin";
    const isTrainer = role === "trainer";

    if (!isAdmin && !isTrainer) {
      return jsonResponse(
        {
          success: false,
          reason: "FORBIDDEN",
          message: "Only trainers/admins can set attendance.",
          debugId,
        },
        403
      );
    }

    // Session ownership + state checks
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("id, trainer_id, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return jsonResponse(
        {
          success: false,
          reason: "SESSION_NOT_FOUND",
          message: "Session not found.",
          debugId,
        },
        404
      );
    }

    if (!isAdmin && session.trainer_id !== user.id) {
      return jsonResponse(
        {
          success: false,
          reason: "FORBIDDEN",
          message: "You can only mark attendance for your own sessions.",
          debugId,
        },
        403
      );
    }

    if (session.status !== "active") {
      return jsonResponse(
        {
          success: false,
          reason: "SESSION_NOT_ACTIVE",
          message: "Manual attendance is only allowed for active sessions.",
          debugId,
        },
        400
      );
    }

    const mapped = mapManualStatus(status);
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("attendance")
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          status: mapped.attendanceStatus,
          attendance_type: mapped.attendanceType,
          join_time: mapped.attendanceStatus === "present" ? nowIso : null,
        },
        { onConflict: "session_id,user_id" }
      );

    if (upsertError) {
      console.error(`[${debugId}] attendance upsert error`, upsertError);
      return jsonResponse(
        {
          success: false,
          reason: "ATTENDANCE_UPSERT_FAILED",
          message: "Failed to update attendance.",
          debugId,
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Attendance updated.",
        status: mapped.attendanceStatus,
        attendanceType: mapped.attendanceType,
        debugId,
      },
      200
    );
  } catch (error) {
    console.error(`[${crypto.randomUUID()}] Fatal error`, error);
    return jsonResponse(
      {
        success: false,
        reason: "INTERNAL_ERROR",
        message: "Unexpected server error.",
      },
      500
    );
  }
});
