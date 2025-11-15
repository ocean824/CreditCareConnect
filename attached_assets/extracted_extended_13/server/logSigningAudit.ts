import { supabase } from './integrations/supabaseClient';

export async function logSigningAudit(userId: string, pdfPath: string, ip = '127.0.0.1') {
  const { error } = await supabase.from('signing_audit_logs').insert([
    {
      user_id: userId,
      pdf_path: pdfPath,
      signed_at: new Date().toISOString(),
      ip_address: ip
    }
  ]);
  if (error) console.error("Audit log failed:", error.message);
}