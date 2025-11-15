import { supabase } from './integrations/supabaseClient';

export async function uploadSignatureToSupabase(base64: string, userId: string) {
  const fileName = `${userId}_signature_${Date.now()}.png`;
  const blob = await fetch(base64).then(res => res.blob());

  const { data, error } = await supabase.storage
    .from('signatures')
    .upload(fileName, blob, { contentType: 'image/png' });

  if (error) {
    console.error('Upload error:', error.message);
    return { success: false, error };
  }

  const url = supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;

  // Log metadata
  await supabase.from('signature_logs').insert([
    { user_id: userId, file_name: fileName, url, signed_at: new Date().toISOString() }
  ]);

  return { success: true, fileName, url };
}