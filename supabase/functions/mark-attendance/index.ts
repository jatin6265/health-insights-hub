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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const debugId = crypto.randomUUID();
  console.log(`[${debugId}] Attendance request received`);

  try {
    // Parse request body
    const body = await req.json();
    const { token, sessionId } = body;

    if (!token || !sessionId) {
      return jsonResponse(
        { success: false, message: "Missing QR token or session ID. Please scan a valid QR code.", debugId },
        400
      );
    }

    // Check authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { success: false, message: "Please log in to mark your attendance.", debugId },
        401
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error(`[${debugId}] Server misconfigured - missing env vars`);
      return jsonResponse(
        { success: false, message: "Server configuration error. Please contact support.", debugId },
        500
      );
    }

    // Create user client to verify JWT
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.log(`[${debugId}] Authentication failed:`, userError);
      return jsonResponse(
        { success: false, message: "Your session has expired. Please log in again.", debugId },
        401
      );
    }

    console.log(`[${debugId}] User authenticated: ${user.id}`);

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Fetch session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id, title, status, qr_token, qr_expires_at, scheduled_date, start_time, late_threshold_minutes")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      console.log(`[${debugId}] Session not found:`, sessionError);
      return jsonResponse(
        { success: false, message: "This QR code is invalid. The session may have been deleted or the QR code is corrupted.", debugId },
        400
      );
    }

    // Validate session status
    if (session.status !== "active") {
      const statusMessages: Record<string, string> = {
        scheduled: "This session hasn't started yet. Please wait for your trainer to start the session.",
        completed: "This session has already ended. Attendance can no longer be marked.",
        cancelled: "This session has been cancelled.",
      };
      return jsonResponse(
        { success: false, message: statusMessages[session.status] || "This session is not currently active.", debugId },
        400
      );
    }

    // Validate QR token
    if (session.qr_token !== token) {
      console.log(`[${debugId}] Invalid QR token`);
      return jsonResponse(
        { success: false, message: "This QR code is outdated. Please ask your trainer to display a fresh QR code.", debugId },
        400
      );
    }

    // Check QR expiry
    if (session.qr_expires_at && new Date(session.qr_expires_at) < new Date()) {
      console.log(`[${debugId}] QR code expired`);
      return jsonResponse(
        { success: false, message: "This QR code has expired. Please ask your trainer to refresh the QR code and try again.", debugId },
        400
      );
    }

    // Check if user is a participant
    const { data: participant } = await supabaseAdmin
      .from("session_participants")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!participant) {
      console.log(`[${debugId}] User not enrolled in session`);
      return jsonResponse(
        { 
          success: false, 
          message: `You are not enrolled in "${session.title}". Please ask your trainer to add you as a participant, or use the self-enrollment feature in your dashboard.`,
          debugId 
        },
        403
      );
    }

    // Check for existing attendance
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && existing.status !== "absent") {
      const statusLabel = existing.status === "late" ? "late" : "present";
      return jsonResponse(
        { success: true, message: `Your attendance was already recorded as ${statusLabel}.`, status: existing.status, debugId },
        200
      );
    }

    // Calculate if late
    const now = new Date();
    const sessionStart = new Date(`${session.scheduled_date}T${session.start_time}`);
    const lateThreshold = session.late_threshold_minutes ?? 15;
    const lateTime = new Date(sessionStart.getTime() + lateThreshold * 60000);
    const status = now > lateTime ? "late" : "present";

    // Prepare attendance record
    const attendancePayload = {
      session_id: sessionId,
      user_id: user.id,
      status,
      join_time: now.toISOString(),
      qr_token_used: token,
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      user_agent: req.headers.get("user-agent") ?? "unknown",
    };

    // Insert or update attendance
    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("attendance")
        .update(attendancePayload)
        .eq("id", existing.id);
      
      if (updateError) {
        console.error(`[${debugId}] Failed to update attendance:`, updateError);
        return jsonResponse(
          { success: false, message: "Failed to update your attendance. Please try again.", debugId },
          500
        );
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("attendance")
        .insert(attendancePayload);
      
      if (insertError) {
        console.error(`[${debugId}] Failed to insert attendance:`, insertError);
        return jsonResponse(
          { success: false, message: "Failed to record your attendance. Please try again.", debugId },
          500
        );
      }
    }

    console.log(`[${debugId}] Attendance marked successfully as ${status}`);

    return jsonResponse(
      {
        success: true,
        message: status === "late" 
          ? "Attendance marked as LATE. You arrived after the grace period."
          : "Attendance marked successfully! You're on time.",
        status,
        debugId,
      },
      200
    );
  } catch (error) {
    console.error(`[${debugId}] Fatal error:`, error);
    return jsonResponse(
      { success: false, message: "An unexpected error occurred. Please try again or contact support.", debugId },
      500
    );
  }
});
