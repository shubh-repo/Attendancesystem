import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Validate required env vars ───────────────────────────────────────
if (!supabaseUrl || !supabaseServiceKey) {
    const errorMsg = `
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  CRITICAL: Missing Supabase environment variables!      ║
╚══════════════════════════════════════════════════════════════╝
   ❌ SUPABASE_URL: ${supabaseUrl ? 'OK' : 'MISSING'}
   ❌ SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'OK' : 'MISSING'}

   → Add them to your Render/Vercel Environment Variables dashboard.
   → Locally, add them to your backend/.env file.
    `;
    console.error(errorMsg);
    // Gracefully exit or throw a clear error to stop the server
    throw new Error('Backend failed to start: Missing Supabase Credentials');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
