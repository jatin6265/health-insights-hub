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
    const { email, password, fullName, adminSecret } = await req.json();

    console.log('Creating admin user:', email);

    // Simple secret check to prevent unauthorized admin creation
    const expectedSecret = Deno.env.get('ADMIN_CREATION_SECRET') || 'create-first-admin-2024';
    
    if (adminSecret !== expectedSecret) {
      console.log('Invalid admin secret');
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the user with admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || 'System Admin',
      },
    });

    if (authError) {
      console.log('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ success: false, message: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Auth user created:', userId);

    // Update the profile to active status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        full_name: fullName || 'System Admin',
        approved_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.log('Error updating profile:', profileError);
    }

    // Update user role to admin
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', userId);

    if (roleError) {
      console.log('Error updating role:', roleError);
      // Try inserting if update fails
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'admin',
      });
    }

    console.log('Admin user created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin user created successfully',
        userId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating admin:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to create admin user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
