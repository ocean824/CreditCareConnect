import { supabase } from './integrations/supabaseClient';

export async function generateSignedPdfUrl(path: string, expiresIn = 300) {
  const { signedURL, error } = await supabase
    .storage
    .from('signatures')
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Signed URL error:", error.message);
    return null;
  }

  return signedURL;
}