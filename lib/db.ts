/**
 * Server-side Supabase client using the service role key.
 * Uses HTTPS (port 443) to communicate with the Supabase REST API,
 * bypassing direct PostgreSQL connections that may be blocked on Vercel.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

/** Generate a CUID-like unique ID using crypto.randomUUID(). */
export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** ISO timestamp for use in updatedAt fields. */
export function now(): string {
  return new Date().toISOString();
}

/** Throw if Supabase returns an error. */
export function assertNoError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}
