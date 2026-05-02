import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Untuk client-side operations (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Default export
export default supabase;
