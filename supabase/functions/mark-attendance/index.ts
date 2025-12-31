import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, sessionId } = await req.json();
    
    console.log('Marking attendance for session:', sessionId);

    if (!token || !sessionId) {
      console.log('Missing token or sessionId');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing token or session ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.log('Invalid user token:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Verify the session exists and is active with valid QR token
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('qr_token', token)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      console.log('Session not found or invalid token:', sessionError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid QR code or session not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if QR code is expired
    if (session.qr_expires_at && new Date(session.qr_expires_at) < new Date()) {
      console.log('QR code expired');
      return new Response(
        JSON.stringify({ success: false, message: 'QR code has expired. Ask trainer to refresh.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a participant of this session
    const { data: participant } = await supabase
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!participant) {
      console.log('User is not a participant of this session');
      return new Response(
        JSON.stringify({ success: false, message: 'You are not enrolled in this session' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already marked attendance
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (existing && existing.status !== 'absent') {
      console.log('Attendance already marked:', existing.status);
      return new Response(
        JSON.stringify({ success: true, message: 'Attendance already recorded' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine attendance status based on late threshold
    const now = new Date();
    const sessionStart = new Date(`${session.scheduled_date}T${session.start_time}`);
    const lateThreshold = session.late_threshold_minutes || 15;
    const lateTime = new Date(sessionStart.getTime() + lateThreshold * 60000);

    const status = now > lateTime ? 'late' : 'present';

    // Mark attendance
    if (existing) {
      // Update existing absent record
      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          status,
          join_time: now.toISOString(),
          qr_token_used: token,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        })
        .eq('id', existing.id);

      if (updateError) {
        console.log('Error updating attendance:', updateError);
        throw updateError;
      }
    } else {
      // Insert new attendance record
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          status,
          join_time: now.toISOString(),
          qr_token_used: token,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
        });

      if (insertError) {
        console.log('Error inserting attendance:', insertError);
        throw insertError;
      }
    }

    const message = status === 'late' 
      ? 'Attendance marked as LATE' 
      : 'Attendance marked successfully!';

    console.log('Attendance marked:', status);

    return new Response(
      JSON.stringify({ success: true, message, status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error marking attendance:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to mark attendance' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
