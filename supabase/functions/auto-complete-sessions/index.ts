import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  console.log("Auto-complete sessions check started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing env vars");
      return new Response(
        JSON.stringify({ success: false, message: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get current timestamp
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

    // Find active sessions that have passed their end time
    const { data: expiredSessions, error: fetchError } = await supabase
      .from("sessions")
      .select("id, title, scheduled_date, end_time")
      .eq("status", "active")
      .or(`scheduled_date.lt.${currentDate},and(scheduled_date.eq.${currentDate},end_time.lte.${currentTime})`);

    if (fetchError) {
      console.error("Error fetching expired sessions:", fetchError);
      return new Response(
        JSON.stringify({ success: false, message: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      console.log("No sessions to auto-complete");
      return new Response(
        JSON.stringify({ success: true, message: "No sessions to complete", completed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredSessions.length} sessions to auto-complete`);

    // Update each session to completed
    const sessionIds = expiredSessions.map(s => s.id);
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        actual_end_time: now.toISOString(),
      })
      .in("id", sessionIds);

    if (updateError) {
      console.error("Error updating sessions:", updateError);
      return new Response(
        JSON.stringify({ success: false, message: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully auto-completed ${expiredSessions.length} sessions`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto-completed ${expiredSessions.length} sessions`,
        completed: expiredSessions.length,
        sessionIds,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Unexpected server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
