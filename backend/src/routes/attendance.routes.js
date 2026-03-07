import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from './auth.routes.js';
import multer from 'multer';
import sharp from 'sharp';

const router = express.Router();

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
router.post('/checkin', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const teacher_id = req.user.id;
        const { lat, lng, device } = req.body;
        const photo = req.file;

        if (!photo) return res.status(400).json({ error: 'Photo is required' });

        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

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

        // 2. Load System Settings
        const { data: settings, error: setErr } = await supabase.from('system_settings').select('*').eq('id', 1).single();
        if (setErr) throw setErr;

        // 3. GPS Validation
        if (settings.gps_enabled) {
            if (!lat || !lng) return res.status(400).json({ error: 'GPS coordinates are required' });
            const distance = getDistanceFromLatLonInMeters(
                parseFloat(lat), parseFloat(lng),
                settings.gps_latitude, settings.gps_longitude
            );

            if (distance > settings.allowed_radius_meters) {
                return res.status(403).json({
                    error: `You are outside the school campus (${Math.round(distance)}m away). Attendance cannot be recorded.`
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
        const startParts = settings.school_start_time.split(':');
        const schoolStartMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const thresholdMin = schoolStartMin + settings.grace_period_minutes;

        const currentParts = currentTime.split(':');
        const currentMin = parseInt(currentParts[0]) * 60 + parseInt(currentParts[1]);

        let status = 'Present';
        let late_minutes = 0;

        if (currentMin > thresholdMin) {
            status = 'Late';
            late_minutes = currentMin - schoolStartMin;
        }

        // 6. Save Record
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

        let result;
        if (existing) {
            result = await supabase.from('attendance').update(insertData).eq('id', existing.id).select().single();
        } else {
            result = await supabase.from('attendance').insert([insertData]).select().single();
        }

        res.json({ message: 'Check-In successful', attendance: result.data });

    } catch (error) {
        console.error('Checkin Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Check-Out Route
router.post('/checkout', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const teacher_id = req.user.id;
        const photo = req.file;

        if (!photo) return res.status(400).json({ error: 'Photo is required' });

        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

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

        // 2. Image Compression & Upload
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

        // 3. Update Record
        const { data, error: updateError } = await supabase
            .from('attendance')
            .update({ out_time: currentTime, out_photo_url })
            .eq('id', existing.id)
            .select()
            .single();

        if (updateError) throw updateError;
        res.json({ message: 'Check-Out successful', attendance: data });

    } catch (error) {
        console.error('Checkout Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Teacher Dashboard
router.get('/my/today', verifyToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
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
        const month = req.query.month; // e.g., "03"
        const year = req.query.year || new Date().getFullYear();

        let query = supabase.from('attendance').select('*').eq('teacher_id', req.user.id).order('date', { ascending: false });

        if (month) {
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
