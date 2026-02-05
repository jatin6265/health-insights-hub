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

function calculateAttendanceType(
  markedAt: Date,
  sessionStart: Date,
  lateThresholdMinutes: number,
  partialThresholdMinutes: number
): AttendanceType {
  const delayMinutes = (markedAt.getTime() - sessionStart.getTime()) / 60000;

  if (delayMinutes <= lateThresholdMinutes) return "on_time";
  if (delayMinutes <= partialThresholdMinutes) return "late";
  return "partial";
}

function getSessionStart(session: {
  actual_start_time: string | null;
  scheduled_date: string;
  start_time: string;
}): Date {
  // Prefer actual_start_time (timestamp with tz) to avoid timezone ambiguity.
  if (session.actual_start_time) return new Date(session.actual_start_time);

  // Fallback: treat scheduled date/time as UTC (best effort).
  // NOTE: If your organization uses a fixed local timezone, consider storing it explicitly.
  return new Date(`${session.scheduled_date}T${session.start_time}Z`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const debugId = crypto.randomUUID();
  console.log(`[${debugId}] process-attendance-request: received`);

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
    const requestId = body.requestId ?? body.request_id;
    const action = body.action;

    if (!requestId || (action !== "approve" && action !== "reject")) {
      return jsonResponse(
        {
          success: false,
          reason: "INVALID_PAYLOAD",
          message: "Missing requestId or invalid action.",
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

    // Verify role (admin or trainer)
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error(`[${debugId}] role check error`, roleError);
    }

    const role = roleRow?.role as string | undefined;
    const isAdmin = role === "admin";
    const isTrainer = role === "trainer";

    if (!isAdmin && !isTrainer) {
      return jsonResponse(
        {
          success: false,
          reason: "FORBIDDEN",
          message: "Only trainers/admins can process attendance requests.",
          debugId,
        },
        403
      );
    }

    const { data: joinRequest, error: jrError } = await supabaseAdmin
      .from("join_requests")
      .select("id, session_id, user_id, status, requested_at")
      .eq("id", requestId)
      .maybeSingle();

    if (jrError || !joinRequest) {
      return jsonResponse(
        {
          success: false,
          reason: "REQUEST_NOT_FOUND",
          message: "Attendance request not found.",
          debugId,
        },
        404
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, title, trainer_id, status, scheduled_date, start_time, actual_start_time, late_threshold_minutes, partial_threshold_minutes"
      )
      .eq("id", joinRequest.session_id)
      .maybeSingle();

    if (sessionError || !session) {
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
          message: "You can only process requests for your own sessions.",
          debugId,
        },
        403
      );
    }

    // Update join request status first
    const nowIso = new Date().toISOString();
    const newStatus = action === "approve" ? "approved" : "rejected";

    const { error: updateReqError } = await supabaseAdmin
      .from("join_requests")
      .update({
        status: newStatus,
        processed_at: nowIso,
        processed_by: user.id,
      })
      .eq("id", joinRequest.id);

    if (updateReqError) {
      console.error(`[${debugId}] join_requests update error`, updateReqError);
      return jsonResponse(
        {
          success: false,
          reason: "REQUEST_UPDATE_FAILED",
          message: "Failed to update request status.",
          debugId,
        },
        500
      );
    }

    if (action === "reject") {
      console.log(`[${debugId}] rejected request ${joinRequest.id}`);
      return jsonResponse(
        {
          success: true,
          status: "rejected",
          message: "Attendance request rejected.",
          debugId,
        },
        200
      );
    }

    // If trainee already has attendance (e.g. QR scan), don't overwrite join_time.
    const { data: existingAttendance } = await supabaseAdmin
      .from("attendance")
      .select("id, status, join_time, attendance_type")
      .eq("session_id", joinRequest.session_id)
      .eq("user_id", joinRequest.user_id)
      .maybeSingle();

    if (
      existingAttendance &&
      existingAttendance.status === "present" &&
      existingAttendance.join_time
    ) {
      return jsonResponse(
        {
          success: true,
          status: "present",
          attendanceType: existingAttendance.attendance_type,
          message: "Already marked present (likely via QR scan).",
          debugId,
        },
        200
      );
    }

    const sessionStart = getSessionStart(session);
    const markedAt = new Date(joinRequest.requested_at);

    const lateThreshold = session.late_threshold_minutes ?? 15;
    const partialThreshold = session.partial_threshold_minutes ?? 30;

    const attendanceType = calculateAttendanceType(
      markedAt,
      sessionStart,
      lateThreshold,
      partialThreshold
    );

    const { error: upsertError } = await supabaseAdmin
      .from("attendance")
      .upsert(
        {
          session_id: joinRequest.session_id,
          user_id: joinRequest.user_id,
          status: "present",
          attendance_type: attendanceType,
          join_time: joinRequest.requested_at,
        },
        { onConflict: "session_id,user_id" }
      );

    if (upsertError) {
      console.error(`[${debugId}] attendance upsert error`, upsertError);
      return jsonResponse(
        {
          success: false,
          reason: "ATTENDANCE_UPSERT_FAILED",
          message: "Failed to mark attendance.",
          debugId,
        },
        500
      );
    }

    console.log(
      `[${debugId}] approved request ${joinRequest.id}; marked ${attendanceType} for ${joinRequest.user_id}`
    );

    return jsonResponse(
      {
        success: true,
        status: "present",
        attendanceType,
        message: `Attendance approved and marked (${attendanceType}).`,
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
