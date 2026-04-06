import dotenv from 'dotenv';
dotenv.config(); // MUST be first so env vars are available when route files load

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './src/routes/auth.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import attendanceRoutes from './src/routes/attendance.routes.js';
import './src/cron/midnightJob.js';
import { supabase } from './src/config/supabase.js';

// Auto-init: ensure system_settings row exists with defaults
(async () => {
    try {
        const { data } = await supabase.from('system_settings').select('id').eq('id', 1).maybeSingle();
        if (!data) {
            await supabase.from('system_settings').insert({
                id: 1,
                school_start_time: '08:00:00',
                school_end_time: '13:00:00',
                half_day_time: '11:00:00',
                grace_period_minutes: 15,
                gps_enabled: true,
                allowed_radius_meters: 1000
            });
            console.log('✅ system_settings initialized with defaults');
        }
    } catch (e) { console.warn('system_settings init skipped:', e.message); }
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Security Headers (CSP, X-Frame, X-Content-Type)
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:; frame-ancestors 'none';");
    res.setHeader('Permissions-Policy', 'camera=self, geolocation=self');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'API is running' });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback for HTML5 history routing
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else {
        next();
    }
});

// Final 404 handler for APIs
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
