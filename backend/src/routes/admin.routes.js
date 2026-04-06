import express from 'express';
import { supabase } from '../config/supabase.js';
import { verifyToken } from './auth.routes.js';
import { cachedSettings } from './attendance.routes.js';

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
        half_day_time: '11:00:00',
        grace_period_minutes: 15,
        gps_enabled: true,
        gps_latitude: null,
        gps_longitude: null,
        allowed_radius_meters: 100
    });
});

// Update System Settings
router.put('/settings', async (req, res) => {
    const {
        school_start_time,
        school_end_time,
        half_day_time,
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
            half_day_time,
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
    cachedSettings.expires = 0; // manual invalidation of worker cache
    res.json({ message: 'Settings updated successfully', settings: data });
});

// Create Teacher (with optional initial password hashing)
router.post('/teachers', async (req, res) => {
    try {
        const { name, mobile, designation, joining_date, email, password } = req.body;
        if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile are required' });

        const trimmedMobile = String(mobile).trim();
        const insertObj = { name: name?.trim(), mobile: trimmedMobile, designation: designation?.trim(), joining_date: joining_date || null, email: email?.trim() || null, status: 'active' };

        if (password) {
            const bcrypt = await import('bcrypt');
            insertObj.password = await bcrypt.default.hash(String(password).trim(), 10);
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
    const kolkataTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
    const today = kolkataTime.split(' ')[0];

    // Detect if today is Sunday (weekend) using IST
    const istDayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date());
    const isSunday = istDayName === 'Sun';

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
        const halfDay = attendance.filter(a => a.status === 'Half Day').length;
        const earlyLeave = attendance.filter(a => a.status === 'Early Leave').length;
        const totalMarked = present + late + absent + halfDay + earlyLeave;

        // "Present Total" = everyone who physically showed up (Present + Late + Half Day + Early Leave)
        const presentTotal = present + late + halfDay + earlyLeave;

        res.json({
            date: today,
            is_sunday: isSunday,
            total_teachers: total,
            present_today: present,
            present_total: presentTotal,
            late_today: late,
            absent_today: absent,
            half_day_today: halfDay,
            early_leave_today: earlyLeave,
            // On Sunday, no one is expected — so unmarked = 0
            unmarked_today: isSunday ? 0 : total - totalMarked
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

// Bulk: Get attendance for a date range (single query — replaces N+1 daily calls)
router.get('/attendance/range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

    try {
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                teachers ( name, designation )
            `)
            .gte('date', from)
            .lte('date', to)
            .order('date')
            .order('in_time');

        if (error) throw error;

        const formatted = data.map(item => ({
            ...item,
            teacher_name: item.teachers?.name,
            designation: item.teachers?.designation
        }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export Monthly Report (all teachers or specific teacher)
router.get('/attendance/export', async (req, res) => {
    const { teacher_id, month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

    const m = String(month).padStart(2, '0');
    const startDate = `${year}-${m}-01`;
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;

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

        const m = String(month).padStart(2, '0');
        const startDate = `${year}-${m}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;

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
            halfDay: records.filter(r => r.status === 'Half Day').length,
            earlyLeave: records.filter(r => r.status === 'Early Leave').length,
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

// ─── Holiday Management ─────────────────────────────────────────────────

// List holidays for a given month/year
router.get('/holidays', async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = supabase.from('holidays').select('*').order('date');

        if (month && year) {
            const m = String(month).padStart(2, '0');
            const startDate = `${year}-${m}-01`;
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a holiday
router.post('/holidays', async (req, res) => {
    try {
        const { date, name } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required' });

        const { data, error } = await supabase
            .from('holidays')
            .upsert({ date, name: name || 'Holiday' }, { onConflict: 'date' })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Holiday added', holiday: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a holiday
router.delete('/holidays/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Holiday removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Manual Cron Trigger (catch-up for missed midnight jobs) ────────────────
router.post('/cron/run', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: 'Date (YYYY-MM-DD) is required' });

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });

        // Skip Sundays
        const d = new Date(date + 'T00:00:00+05:30');
        if (d.getDay() === 0) return res.json({ message: `${date} is a Sunday. No absent marks placed.`, marked: 0 });

        // Skip holidays
        const { data: holiday } = await supabase.from('holidays').select('id, name').eq('date', date).maybeSingle();
        if (holiday) return res.json({ message: `${date} is a holiday (${holiday.name}). No absent marks placed.`, marked: 0 });

        // Get all active teachers
        const { data: teachers, error: tErr } = await supabase.from('teachers').select('id').eq('status', 'active');
        if (tErr) throw tErr;

        // Get who already has attendance
        const { data: existing, error: aErr } = await supabase.from('attendance').select('teacher_id').eq('date', date);
        if (aErr) throw aErr;

        const attendedIds = new Set(existing.map(a => a.teacher_id));
        const absentRecords = teachers
            .filter(t => !attendedIds.has(t.id))
            .map(t => ({ teacher_id: t.id, date, status: 'Absent' }));

        if (absentRecords.length > 0) {
            const { error: insErr } = await supabase.from('attendance').insert(absentRecords);
            if (insErr) throw insErr;
        }

        res.json({ message: `Marked ${absentRecords.length} teachers absent for ${date}`, marked: absentRecords.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
