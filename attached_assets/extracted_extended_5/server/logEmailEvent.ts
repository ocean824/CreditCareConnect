import { supabase } from './integrations/supabaseClient';

export async function logEmailEvent(email: string, type: string, status: string, token = "") {
  const { data, error } = await supabase.from('email_logs').insert([
    { user_email: email, event_type: type, status: status, token_used: token }
  ]);
  if (error) console.error("❌ Email log failed:", error.message);
  return { data, error };
}