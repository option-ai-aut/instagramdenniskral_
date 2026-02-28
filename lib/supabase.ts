import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseAdmin() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function uploadImageToSupabase(
  file: File | Buffer,
  path: string,
  contentType = "image/png"
): Promise<string> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from("images")
    .upload(path, file, { contentType, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = admin.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBase64ToSupabase(
  base64: string,
  path: string,
  mimeType = "image/png"
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  return uploadImageToSupabase(buffer, path, mimeType);
}
