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
    const { data } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle();
    // Return data or default settings if row doesn't exist yet
    res.json(data || {
        id: 1,
        school_start_time: '08:00:00',
        school_end_time: '13:00:00',
        grace_period_minutes: 15,
        gps_enabled: true,
        gps_latitude: null,
        gps_longitude: null,
        allowed_radius_meters: 1000
    });
});

// Update System Settings
router.put('/settings', async (req, res) => {
    const {
        school_start_time,
        school_end_time,
        grace_period_minutes,
        gps_latitude,
        gps_longitude,
        allowed_radius_meters,
        gps_enabled
    } = req.body;

    const { data, error } = await supabase
        .from('system_settings')
        .upsert({
            id: 1,
            school_start_time,
            school_end_time,
            grace_period_minutes,
            gps_latitude,
            gps_longitude,
            allowed_radius_meters,
            gps_enabled,
            updated_at: new Date()
        }, { onConflict: 'id' })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Settings updated successfully', settings: data });
});

// Create Teacher (with optional initial password hashing)
router.post('/teachers', async (req, res) => {
    try {
        const { name, mobile, designation, joining_date, email, password } = req.body;
        if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile are required' });

        const insertObj = { name, mobile, designation, joining_date: joining_date || null, email: email || null, status: 'active' };

        if (password && password.length >= 4) {
            const bcrypt = await import('bcrypt');
            insertObj.password = await bcrypt.default.hash(password, 10);
        }

        const { data, error } = await supabase.from('teachers').insert([insertObj]).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json({ message: 'Teacher created', teacher: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Teacher Status (Block/Active)
router.put('/teachers/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // should be 'active' or 'blocked'

    if (!['active', 'blocked'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    const { data, error } = await supabase
        .from('teachers')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `Teacher status updated to ${status}`, teacher: data });
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
    const today = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).split(' ')[0];
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
    const date = req.query.date || new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).split(' ')[0];
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

// Export Monthly Report (all teachers or specific teacher)
router.get('/attendance/export', async (req, res) => {
    const { teacher_id, month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    let query = supabase.from('attendance').select('date, in_time, out_time, status, late_minutes, teachers!inner(name, designation)').gte('date', startDate).lte('date', endDate).order('date');
    if (teacher_id) query = query.eq('teacher_id', teacher_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Per-Teacher Monthly Summary (for admin monitoring monthly report)
router.get('/teachers/:id/monthly', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        const [teacherRes, attRes] = await Promise.all([
            supabase.from('teachers').select('id, name, designation, mobile, email, joining_date').eq('id', id).single(),
            supabase.from('attendance').select('date, in_time, out_time, status, late_minutes').eq('teacher_id', id).gte('date', startDate).lte('date', endDate).order('date')
        ]);

        if (teacherRes.error) throw teacherRes.error;
        if (attRes.error) throw attRes.error;

        const records = attRes.data || [];
        const summary = {
            present: records.filter(r => r.status === 'Present').length,
            late: records.filter(r => r.status === 'Late').length,
            absent: records.filter(r => r.status === 'Absent').length,
            total_days: records.length,
            avg_late_minutes: records.filter(r => r.late_minutes > 0).reduce((a, b) => a + (b.late_minutes || 0), 0) / (records.filter(r => r.late_minutes > 0).length || 1)
        };

        res.json({ teacher: teacherRes.data, summary, records });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get teacher profile by self (for teacher profile page)
router.get('/teacher-profile', async (req, res) => {
    // This route is placed here but used by teacher themselves
    // Allow only if admin (admin can look up any teacher)
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Teacher id required' });
    const { data, error } = await supabase.from('teachers').select('id, name, designation, mobile, email, joining_date, status').eq('id', id).single();
    if (error) return res.status(404).json({ error: 'Teacher not found' });
    res.json(data);
});

export default router;
