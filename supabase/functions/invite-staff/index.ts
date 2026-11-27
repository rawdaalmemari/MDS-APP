// Lets the CEO add a staff member from the app. Sends a Supabase invite email.
// Deploy: supabase functions deploy invite-staff
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isCeo, error: roleError } = await asCaller.rpc('is_ceo');
  if (roleError || !isCeo) {
    return Response.json({ error: 'Only the CEO can add staff.' }, { status: 403, headers: cors });
  }

  const { email, fullName, role } = await req.json();
  if (typeof email !== 'string' || !email.includes('@') || typeof fullName !== 'string' || !fullName.trim()) {
    return Response.json({ error: 'Name and email are required.' }, { status: 400, headers: cors });
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    data: { full_name: fullName.trim(), role: role === 'ceo' ? 'ceo' : 'staff' },
  });
  if (error) return Response.json({ error: error.message }, { status: 400, headers: cors });
  return Response.json({ id: data.user?.id }, { headers: cors });
});
