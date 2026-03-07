import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from './auth.routes.js';

const router = express.Router();

// Middleware to ensure admin role
const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

router.use(verifyToken, verifyAdmin);

// Get System Settings
router.get('/settings', async (req, res) => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update System Settings
router.put('/settings', async (req, res) => {
    const {
        school_start_time,
        grace_period_minutes,
        gps_latitude,
        gps_longitude,
        allowed_radius_meters,
        gps_enabled
    } = req.body;

    const { data, error } = await supabase
        .from('system_settings')
        .update({
            school_start_time,
            grace_period_minutes,
            gps_latitude,
            gps_longitude,
            allowed_radius_meters,
            gps_enabled,
            updated_at: new Date()
        })
        .eq('id', 1)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Settings updated successfully', settings: data });
});

// Create Teacher
router.post('/teachers', async (req, res) => {
    const { name, mobile, designation, joining_date } = req.body;
    const { data, error } = await supabase
        .from('teachers')
        .insert([{ name, mobile, designation, joining_date }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: 'Teacher created', teacher: data });
});

// Get all Teachers
router.get('/teachers', async (req, res) => {
    const { data, error } = await supabase.from('teachers').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete Teacher
router.delete('/teachers/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Teacher deleted successfully' });
});

// Get Dashboard Stats (Today)
router.get('/dashboard/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const { data: teachers, error: tError } = await supabase.from('teachers').select('id', { count: 'exact' });
        if (tError) throw tError;

        const { data: attendance, error: aError } = await supabase
            .from('attendance')
            .select('status')
            .eq('date', today);
        if (aError) throw aError;

        const total = teachers.length;
        const present = attendance.filter(a => a.status === 'Present').length;
        const late = attendance.filter(a => a.status === 'Late').length;
        const absent = attendance.filter(a => a.status === 'Absent').length;

        res.json({
            date: today,
            total_teachers: total,
            present_today: present,
            late_today: late,
            absent_today: absent,
            unmarked_today: total - (present + late + absent)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Daily Attendance List
router.get('/attendance/daily', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('attendance')
        .select(`
            *,
            teachers ( name, designation )
        `)
        .eq('date', date)
        .order('in_time');

    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(item => ({
        ...item,
        teacher_name: item.teachers?.name,
        designation: item.teachers?.designation
    }));
    res.json(formatted);
});

// Export Monthly Report
router.get('/attendance/export', async (req, res) => {
    const { teacher_id, month, year } = req.query;

    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    let query = supabase.from('attendance').select('date, in_time, out_time, status, late_minutes, teachers!inner(name)').gte('date', startDate).lte('date', endDate).order('date');
    if (teacher_id) query = query.eq('teacher_id', teacher_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Simplistic JSON return, frontend can convert to CSV/Excel
    res.json(data);
});

export default router;
