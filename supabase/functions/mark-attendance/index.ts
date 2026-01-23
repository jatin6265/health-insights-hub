import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // change to your Vercel domain later
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* -------------------- Server -------------------- */
serve(async (req) => {
  // ✅ CORS preflight (CRITICAL)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  const debugId = crypto.randomUUID();

  try {
    console.log(`[${debugId}] Request received`);

    /* -------------------- Parse body -------------------- */
    const body = await req.json();
    const { token, sessionId } = body;

    if (!token || !sessionId) {
      return jsonResponse(
        { success: false, message: "Missing token or sessionId", debugId },
        400
      );
    }

    /* -------------------- Auth header -------------------- */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { success: false, message: "Not authenticated", debugId },
        401
      );
    }

    /* -------------------- Env vars -------------------- */
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse(
        { success: false, message: "Server misconfigured", debugId },
        500
      );
    }

    /* -------------------- User client (JWT) -------------------- */
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { success: false, message: "Invalid authentication", debugId },
        401
      );
    }

    /* -------------------- Admin client -------------------- */
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    /* -------------------- Fetch session -------------------- */
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select(
        `
        id,
        status,
        qr_token,
        qr_expires_at,
        scheduled_date,
        start_time,
        late_threshold_minutes
      `
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
<<<<<<< HEAD
      console.log('Session not found or invalid token:', sessionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Invalid or expired QR code. Please ask your trainer to refresh the QR code and try again.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if QR code is expired
    if (session.qr_expires_at && new Date(session.qr_expires_at) < new Date()) {
      console.log('QR code expired');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'This QR code has expired. Please ask your trainer to display a fresh QR code.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
=======
      return jsonResponse(
        { success: false, message: "Session not found", debugId },
        400
      );
    }

    if (session.status !== "active") {
      return jsonResponse(
        {
          success: false,
          message: "Session is not active",
          status: session.status,
          debugId,
        },
        400
>>>>>>> 8fa4d02 (fix: resolve attendance marking CORS and logic issues)
      );
    }

    if (session.qr_token !== token) {
      return jsonResponse(
        { success: false, message: "Invalid QR code", debugId },
        400
      );
    }

    if (
      session.qr_expires_at &&
      new Date(session.qr_expires_at) < new Date()
    ) {
      return jsonResponse(
        {
          success: false,
          message: "QR code has expired. Ask trainer to refresh.",
          debugId,
        },
        400
      );
    }

    /* -------------------- Participant check -------------------- */
    const { data: participant } = await supabaseAdmin
      .from("session_participants")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!participant) {
<<<<<<< HEAD
      console.log('User is not a participant of this session');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `You are not enrolled in "${session.title}". Please ask your trainer to add you as a participant, or use the self-enrollment feature if available.` 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
=======
      return jsonResponse(
        {
          success: false,
          message: "You are not enrolled in this session",
          debugId,
        },
        403
>>>>>>> 8fa4d02 (fix: resolve attendance marking CORS and logic issues)
      );
    }

    /* -------------------- Attendance check -------------------- */
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
          message: "Attendance already recorded",
          status: existing.status,
          debugId,
        },
        200
      );
    }

    /* -------------------- Late logic -------------------- */
    const now = new Date();
    const sessionStart = new Date(
      `${session.scheduled_date}T${session.start_time}`
    );

    const lateThreshold = session.late_threshold_minutes ?? 15;
    const lateTime = new Date(
      sessionStart.getTime() + lateThreshold * 60000
    );

    const status = now > lateTime ? "late" : "present";

    /* -------------------- Write attendance -------------------- */
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
      await supabaseAdmin.from("attendance").insert(attendancePayload);
    }

    return jsonResponse(
      {
        success: true,
        message:
          status === "late"
            ? "Attendance marked as LATE"
            : "Attendance marked successfully",
        status,
        debugId,
      },
      200
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return jsonResponse(
      { success: false, message: "Failed to mark attendance" },
      500
    );
  }
});

/* -------------------- Helper -------------------- */
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
