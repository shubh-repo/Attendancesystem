import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Backend uses the Service Role Key to bypass RLS.
// Authentication is already handled by our own JWT middleware (verifyToken),
// so we don't need Supabase's RLS to gate access — the backend IS the trusted authority.
if (!supabaseServiceKey) {
    console.error(
        '⚠️  SUPABASE_SERVICE_ROLE_KEY is missing from your .env file!\n' +
        '   The backend will NOT work correctly without it.\n' +
        '   Find it in: Supabase Dashboard → Settings → API → service_role (secret)'
    );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
