import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const debugId = crypto.randomUUID();
  console.log(`[${debugId}] Attendance request received`);

  try {
    /* ---------- Parse body ---------- */
    const body = await req.json();

    const token =
      body.token ??
      body.qrToken ??
      body.qr_token;

    const sessionId =
      body.sessionId ??
      body.session ??
      body.session_id;

    if (!token || !sessionId) {
      return jsonResponse(
        {
          success: false,
          reason: "INVALID_PAYLOAD",
          message: "Missing QR token or session ID.",
          debugId,
        },
        400
      );
    }

    /* ---------- Auth ---------- */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        {
          success: false,
          reason: "NOT_AUTHENTICATED",
          message: "Please log in to mark attendance.",
          debugId,
        },
        401
      );
    }

    /* ---------- Env ---------- */
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

    /* ---------- Verify user ---------- */
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } =
      await supabaseUser.auth.getUser();

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

    /* ---------- Admin client ---------- */
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    /* ---------- Fetch session ---------- */
    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select(
        "id, title, status, qr_token, qr_expires_at, scheduled_date, start_time, late_threshold_minutes"
      )
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
        400
      );
    }

    if (session.status !== "active") {
      return jsonResponse(
        {
          success: false,
          reason: "SESSION_INACTIVE",
          message: "Session is not active.",
          debugId,
        },
        400
      );
    }

    /* ---------- QR expiry FIRST ---------- */
    if (
      session.qr_expires_at &&
      new Date(session.qr_expires_at).getTime() <= Date.now()
    ) {
      return jsonResponse(
        {
          success: false,
          reason: "QR_EXPIRED",
          message: "QR code has expired. Please refresh.",
          debugId,
        },
        400
      );
    }

    /* ---------- QR token match ---------- */
    if (session.qr_token !== token) {
      return jsonResponse(
        {
          success: false,
          reason: "QR_TOKEN_MISMATCH",
          message: "QR code is outdated. Please refresh.",
          debugId,
        },
        400
      );
    }

    /* ---------- Participant check ---------- */
    const { data: participant } = await supabaseAdmin
      .from("session_participants")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!participant) {
      return jsonResponse(
        {
          success: false,
          reason: "NOT_ENROLLED",
          message: `You are not enrolled in "${session.title}".`,
          debugId,
        },
        403
      );
    }

    /* ---------- Attendance check ---------- */
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && existing.status !== "absent") {
      return jsonResponse(
        {
          success: true,
          message: `Attendance already marked as ${existing.status}.`,
          status: existing.status,
          debugId,
        },
        200
      );
    }

    /* ---------- Late logic ---------- */
    const now = new Date();
    const sessionStart = new Date(
      `${session.scheduled_date}T${session.start_time}+00:00`
    );

    const lateThreshold = session.late_threshold_minutes ?? 15;
    const lateTime = new Date(sessionStart.getTime() + lateThreshold * 60000);
    const status = now > lateTime ? "late" : "present";

    const attendancePayload = {
      session_id: sessionId,
      user_id: user.id,
      status,
      join_time: now.toISOString(),
      qr_token_used: token,
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      user_agent: req.headers.get("user-agent") ?? "unknown",
    };

    if (existing) {
      await supabaseAdmin
        .from("attendance")
        .update(attendancePayload)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("attendance")
        .insert(attendancePayload);
    }

    return jsonResponse(
      {
        success: true,
        message:
          status === "late"
            ? "Attendance marked as LATE."
            : "Attendance marked successfully.",
        status,
        debugId,
      },
      200
    );
  } catch (error) {
    console.error(`[${debugId}] Fatal error`, error);
    return jsonResponse(
      {
        success: false,
        reason: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        debugId,
      },
      500
    );
  }
});
