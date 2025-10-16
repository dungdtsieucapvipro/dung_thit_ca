import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || (window as any).APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (window as any).APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Cảnh báo để dev biết thiếu cấu hình, tránh crash app
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env or app-config.json"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


