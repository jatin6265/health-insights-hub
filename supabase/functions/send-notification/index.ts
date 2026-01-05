import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationPayload {
  type: 'session_reminder' | 'attendance_confirmation' | 'session_cancelled' | 'session_updated' | 'session_assigned';
  sessionId?: string;
  userId?: string;
  userIds?: string[];
  customMessage?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    console.log('Sending notification:', payload);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let recipients: { email: string; name: string; userId: string }[] = [];
    let subject = '';
    let htmlContent = '';

    if (payload.type === 'session_reminder' && payload.sessionId) {
      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          trainings (title)
        `)
        .eq('id', payload.sessionId)
        .single();

      if (sessionError || !session) {
        console.error('Session not found:', sessionError);
        return new Response(
          JSON.stringify({ success: false, message: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', payload.sessionId);

      if (participants && participants.length > 0) {
        const userIds = participants.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        recipients = (profiles || [])
          .filter(p => p.email)
          .map(p => ({
            email: p.email!,
            name: p.full_name || 'Trainee',
            userId: p.id,
          }));
      }

      subject = `Reminder: ${session.title} - ${session.scheduled_date}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a2e;">Session Reminder</h1>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #16213e; margin-top: 0;">${session.title}</h2>
            <p style="color: #666;"><strong>Training:</strong> ${(session.trainings as any)?.title || 'N/A'}</p>
            <p style="color: #666;"><strong>Date:</strong> ${session.scheduled_date}</p>
            <p style="color: #666;"><strong>Time:</strong> ${session.start_time} - ${session.end_time}</p>
            ${session.location ? `<p style="color: #666;"><strong>Location:</strong> ${session.location}</p>` : ''}
          </div>
          <p style="color: #666;">Please be on time to mark your attendance via QR code scanning.</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated reminder from your Training Management System.</p>
        </div>
      `;

    } else if (payload.type === 'attendance_confirmation' && payload.sessionId && payload.userId) {
      // Get user and session details
      const [userResult, sessionResult] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name').eq('id', payload.userId).single(),
        supabase.from('sessions').select('*, trainings (title)').eq('id', payload.sessionId).single(),
      ]);

      if (userResult.data?.email && sessionResult.data) {
        recipients = [{
          email: userResult.data.email,
          name: userResult.data.full_name || 'Trainee',
          userId: userResult.data.id,
        }];

        const session = sessionResult.data;
        subject = `Attendance Confirmed: ${session.title}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Attendance Confirmed ✓</h1>
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #155724; margin-top: 0;">Your attendance has been recorded</h2>
              <p style="color: #155724;"><strong>Session:</strong> ${session.title}</p>
              <p style="color: #155724;"><strong>Training:</strong> ${(session.trainings as any)?.title || 'N/A'}</p>
              <p style="color: #155724;"><strong>Date:</strong> ${session.scheduled_date}</p>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated confirmation from your Training Management System.</p>
          </div>
        `;
      }

    } else if (payload.type === 'session_cancelled' && payload.sessionId) {
      // Get session and all participants
      const { data: session } = await supabase
        .from('sessions')
        .select('*, trainings (title)')
        .eq('id', payload.sessionId)
        .single();

      if (session) {
        const { data: participants } = await supabase
          .from('session_participants')
          .select('user_id')
          .eq('session_id', payload.sessionId);

        if (participants && participants.length > 0) {
          const userIds = participants.map(p => p.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

          recipients = (profiles || [])
            .filter(p => p.email)
            .map(p => ({
              email: p.email!,
              name: p.full_name || 'Trainee',
              userId: p.id,
            }));
        }

        subject = `Session Cancelled: ${session.title}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc3545;">Session Cancelled</h1>
            <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #721c24; margin-top: 0;">${session.title}</h2>
              <p style="color: #721c24;"><strong>Originally scheduled:</strong> ${session.scheduled_date} at ${session.start_time}</p>
              ${payload.customMessage ? `<p style="color: #721c24;"><strong>Reason:</strong> ${payload.customMessage}</p>` : ''}
            </div>
            <p style="color: #666;">We apologize for any inconvenience. Please check the system for updated schedules.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from your Training Management System.</p>
          </div>
        `;
      }
    } else if (payload.type === 'session_assigned' && payload.sessionId && payload.userIds) {
      // Get session details
      const { data: session } = await supabase
        .from('sessions')
        .select('*, trainings (title)')
        .eq('id', payload.sessionId)
        .single();

      if (session && payload.userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', payload.userIds);

        recipients = (profiles || [])
          .filter(p => p.email)
          .map(p => ({
            email: p.email!,
            name: p.full_name || 'Trainee',
            userId: p.id,
          }));

        subject = `New Session Assigned: ${session.title}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">You've Been Assigned to a Session</h1>
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #1565c0; margin-top: 0;">${session.title}</h2>
              <p style="color: #1565c0;"><strong>Training:</strong> ${(session.trainings as any)?.title || 'N/A'}</p>
              <p style="color: #1565c0;"><strong>Date:</strong> ${session.scheduled_date}</p>
              <p style="color: #1565c0;"><strong>Time:</strong> ${session.start_time} - ${session.end_time}</p>
              ${session.location ? `<p style="color: #1565c0;"><strong>Location:</strong> ${session.location}</p>` : ''}
            </div>
            <p style="color: #666;">Please make sure to attend and mark your attendance via QR code scanning.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from your Training Management System.</p>
          </div>
        `;
      }
    }

    if (recipients.length === 0) {
      console.log('No recipients found');
      return new Response(
        JSON.stringify({ success: false, message: 'No recipients found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending to ${recipients.length} recipients`);

    // Send emails
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const { error } = await resend.emails.send({
          from: 'Training System <onboarding@resend.dev>',
          to: [recipient.email],
          subject,
          html: htmlContent.replace('{{name}}', recipient.name),
        });

        if (error) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          return { email: recipient.email, success: false, error };
        }

        // Create in-app notification
        await supabase.from('notifications').insert({
          user_id: recipient.userId,
          title: subject,
          message: payload.customMessage || `Notification for ${payload.type.replace(/_/g, ' ')}`,
          type: payload.type,
        });

        console.log(`Email sent to ${recipient.email}`);
        return { email: recipient.email, success: true };
      } catch (err) {
        console.error(`Error sending to ${recipient.email}:`, err);
        return { email: recipient.email, success: false, error: err };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Sent ${successCount}/${recipients.length} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount} of ${recipients.length} notifications`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to send notification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
