import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from './auth.routes.js';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';

const router = express.Router();

export let cachedSettings = { data: null, expires: 0 };

const withRetry = async (fn, retries = 2, delay = 500) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, delay));
        }
    }
};

const checkinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Too many check-in attempts. Please try again after 15 minutes.' } });
const checkoutLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Too many check-out attempts. Please try again after 15 minutes.' } });

async function getSystemSettings() {
    if (Date.now() > cachedSettings.expires) {
        return await withRetry(async () => {
            const { data: settings, error } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle();
            if (error) throw error;
            cachedSettings = { data: settings || {}, expires: Date.now() + 5 * 60 * 1000 };
            return cachedSettings.data;
        });
    }
    return cachedSettings.data;
}

// Setup Multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB initially
});

// Helper function to calculate distance using Haversine formula
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radius of the earth in m
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in m
};

// Check-In Route
router.post('/checkin', verifyToken, checkinLimiter, upload.single('photo'), async (req, res) => {
    try {
        const teacher_id = req.user.id;
        const { lat, lng, device } = req.body;
        const photo = req.file;

        if (!photo) return res.status(400).json({ error: 'Photo is required' });

        const kolkataTimeStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
        const [today, currentTime] = kolkataTimeStr.split(' ');

        // 1. Check if already checked-in
        const { data: existing, error: existError } = await supabase
            .from('attendance')
            .select('*')
            .eq('teacher_id', teacher_id)
            .eq('date', today)
            .single();

        if (existing && existing.in_time) {
            return res.status(400).json({ error: 'Check-In already recorded for today' });
        }

        // 2. Load System Settings (Cached)
        const cfg = await getSystemSettings();
        const gpsEnabled = cfg.gps_enabled !== false; // default: enabled
        const schoolLat = parseFloat(cfg.gps_latitude) || null;
        const schoolLng = parseFloat(cfg.gps_longitude) || null;
        const allowedRadius = parseInt(cfg.allowed_radius_meters) || 1000;
        const schoolStartTime = cfg.school_start_time || '08:00:00';
        const gracePeriodMins = parseInt(cfg.grace_period_minutes) ?? 15;

        // 3. GPS Validation
        if (gpsEnabled && schoolLat !== null && schoolLng !== null) {
            if (!lat || !lng) {
                return res.status(403).json({ error: 'GPS location access is strictly required to check in. Please allow location permissions in your browser.' });
            }
            const distance = getDistanceFromLatLonInMeters(
                parseFloat(lat), parseFloat(lng), schoolLat, schoolLng
            );
            console.log(`GPS check: ${Math.round(distance)}m from school (allowed: ${allowedRadius}m)`);
            if (distance > allowedRadius) {
                return res.status(403).json({
                    error: `You are outside the school campus (${Math.round(distance)}m away, allowed ${allowedRadius}m). Please check in from the school premises.`
                });
            }
        }

        // 4. Image Compression & Upload
        const compressedImageBuffer = await sharp(photo.buffer)
            .resize({ width: 720 })
            .jpeg({ quality: 80 })
            .toBuffer();

        const fileName = `${teacher_id}/${today}-in.jpg`;
        const { error: uploadError } = await supabase.storage
            .from('attendance-images')
            .upload(fileName, compressedImageBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('attendance-images').getPublicUrl(fileName);
        const in_photo_url = publicUrlData.publicUrl;

        // 5. Late Calculation
        const toMins = t => { const p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
        const startMinutes = toMins(schoolStartTime);
        const thresholdMin = startMinutes + gracePeriodMins;
        const currentMin = toMins(currentTime);

        let status = 'Present';
        let late_minutes = 0;

        if (currentMin > thresholdMin) {
            status = 'Late';
            late_minutes = currentMin - startMinutes; // minutes after school start (not threshold)
        }

        // 6. Save Record (with Retry Logic for DB resilience)
        let insertData = {
            teacher_id,
            date: today,
            in_time: currentTime,
            status,
            late_minutes,
            in_photo_url,
            gps_lat: parseFloat(lat),
            gps_long: parseFloat(lng),
            device
        };

        let result = await withRetry(async () => {
            if (existing) {
                let res = await supabase.from('attendance').update(insertData).eq('id', existing.id).select().single();
                if (res.error) throw res.error;
                return res;
            } else {
                let res = await supabase.from('attendance').insert([insertData]).select().single();
                if (res.error) throw res.error;
                return res;
            }
        });

        res.json({ message: 'Check-In successful', attendance: result.data });

    } catch (error) {
        console.error('Checkin Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Check-Out Route
router.post('/checkout', verifyToken, checkoutLimiter, upload.single('photo'), async (req, res) => {
    try {
        const teacher_id = req.user.id;
        const photo = req.file;
        const { lat, lng, device } = req.body;

        if (!photo) return res.status(400).json({ error: 'Photo is required' });

        const kolkataTimeStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
        const [today, currentTime] = kolkataTimeStr.split(' ');

        // 1. Ensure Check-In exists
        const { data: existing, error: existError } = await supabase
            .from('attendance')
            .select('*')
            .eq('teacher_id', teacher_id)
            .eq('date', today)
            .single();

        if (!existing || !existing.in_time) {
            return res.status(400).json({ error: 'Check-In required before Check-Out' });
        }
        if (existing.out_time) {
            return res.status(400).json({ error: 'Check-Out already recorded for today' });
        }

        // 2. Load System Settings for GPS Validation & Early Leave (Cached)
        const cfg = await getSystemSettings();
        const schoolEndTime = cfg.school_end_time || '13:00:00';
        const halfDayTime = cfg.half_day_time || '11:00:00';
        const gpsEnabled = cfg.gps_enabled !== false;
        const schoolLat = parseFloat(cfg.gps_latitude) || null;
        const schoolLng = parseFloat(cfg.gps_longitude) || null;
        const allowedRadius = parseInt(cfg.allowed_radius_meters) || 1000;

        // 3. GPS Validation
        if (gpsEnabled && schoolLat !== null && schoolLng !== null) {
            if (!lat || !lng) {
                return res.status(403).json({ error: 'GPS location access is strictly required to check out. Please allow location permissions in your browser.' });
            }
            const distance = getDistanceFromLatLonInMeters(
                parseFloat(lat), parseFloat(lng), schoolLat, schoolLng
            );
            console.log(`GPS check out: ${Math.round(distance)}m from school (allowed: ${allowedRadius}m)`);
            if (distance > allowedRadius) {
                return res.status(403).json({
                    error: `You are outside the school campus (${Math.round(distance)}m away, allowed ${allowedRadius}m). Please check out from the school premises.`
                });
            }
        }

        // 4. Image Compression & Upload
        const compressedImageBuffer = await sharp(photo.buffer)
            .resize({ width: 720 })
            .jpeg({ quality: 80 })
            .toBuffer();

        const fileName = `${teacher_id}/${today}-out.jpg`;
        const { error: uploadError } = await supabase.storage
            .from('attendance-images')
            .upload(fileName, compressedImageBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('attendance-images').getPublicUrl(fileName);
        const out_photo_url = publicUrlData.publicUrl;

        // 5. Determine Final Status
        let finalStatus = existing.status;
        const toMins = t => { const p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
        const curMins = toMins(currentTime);
        const halfDayMins = toMins(halfDayTime);
        const endMins = toMins(schoolEndTime);

        if (curMins < halfDayMins) {
            finalStatus = 'Half Day';
            console.log(`Checked out at ${currentTime} before half-day threshold ${halfDayTime} → Half Day`);
        } else if (curMins < endMins) {
            finalStatus = 'Early Leave';
            console.log(`Checked out at ${currentTime} before school end ${schoolEndTime} → Early Leave`);
        }

        // 6. Update attendance record with checkout data (with Retry)
        const updatedRecord = await withRetry(async () => {
            const res = await supabase
                .from('attendance')
                .update({
                    out_time: currentTime,
                    out_photo_url,
                    status: finalStatus,
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (res.error) throw res.error;
            return res.data;
        });

        let finalMessage = 'Check-Out successful';
        if (finalStatus === 'Half Day') finalMessage += ' (Half Day recorded)';
        else if (finalStatus === 'Early Leave') finalMessage += ' (Early Leave recorded)';

        res.json({ message: finalMessage, attendance: updatedRecord });

    } catch (error) {
        console.error('Checkout Error:', error);
        const errorMsg = error.message || 'An unexpected database error occurred during checkout.';
        res.status(500).json({ error: errorMsg });
    }
});


// Teacher Dashboard
router.get('/my/today', verifyToken, async (req, res) => {
    try {
        const kolkataTimeStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
        const today = kolkataTimeStr.split(' ')[0];
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('teacher_id', req.user.id)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows

        res.json({ attendance: data || null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher History
router.get('/my/history', verifyToken, async (req, res) => {
    try {
        const month = req.query.month;
        const year = req.query.year || new Date().getFullYear();
        const limit = parseInt(req.query.limit) || 15;
        const page  = parseInt(req.query.page)  || 0;
        const offset = page * limit;

        let query = supabase.from('attendance').select('*', { count: 'exact' })
            .eq('teacher_id', req.user.id)
            .order('date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (month) {
            const m = String(month).padStart(2, '0');
            const startDate = `${year}-${m}-01`;
            const lastDay = new Date(year, parseInt(month), 0).getDate();
            const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data, error, count } = await query;
        if (error) throw error;
        res.json({ records: data, total: count, page, limit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher Monthly Stats (for dashboard)
router.get('/my/monthly-stats', verifyToken, async (req, res) => {
    try {
        const nowKolkata = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const y = nowKolkata.getFullYear();
        const m = String(nowKolkata.getMonth() + 1).padStart(2, '0');
        
        const startStr = `${y}-${m}-01`;
        const endStr = nowKolkata.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).split(' ')[0];

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('teacher_id', req.user.id)
            .gte('date', startStr)
            .lte('date', endStr)
            .order('date', { ascending: false });

        if (error) throw error;

        const present = data.filter(r => r.status === 'Present').length;
        const late = data.filter(r => r.status === 'Late').length;
        const absent = data.filter(r => r.status === 'Absent').length;
        const halfDay = data.filter(r => r.status === 'Half Day').length;
        const earlyLeave = data.filter(r => r.status === 'Early Leave').length;
        const totalDays = data.length;
        // Punctuality = on-time arrivals vs total working days tracked
        const onTime = present + halfDay + earlyLeave;
        const punctuality = totalDays > 0 ? Math.round((onTime / totalDays) * 100) : null;

        res.json({ records: data, present, late, absent, halfDay, earlyLeave, punctuality, totalDays });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Teacher: Get own profile from DB (fresh data)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('teachers')
            .select('id, name, designation, mobile, email, joining_date, status')
            .eq('id', req.user.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
