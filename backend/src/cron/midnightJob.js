import { supabase } from '../config/supabase.js';

// Cron job to run at 23:59 daily
import cron from 'node-cron';

// Execute every day at 11:59 PM
cron.schedule('59 23 * * *', async () => {
    console.log('Running midnight cron job for missing attendance...');
    try {
        const today = new Date().toISOString().split('T')[0];

        // Get all teachers
        const { data: teachers, error: teacherError } = await supabase
            .from('teachers')
            .select('id');

        if (teacherError) throw teacherError;
        if (!teachers || teachers.length === 0) return;

        // Get all attendance for today
        const { data: attendance, error: attendanceError } = await supabase
            .from('attendance')
            .select('teacher_id')
            .eq('date', today);

        if (attendanceError) throw attendanceError;

        const attendedTeacherIds = attendance.map(a => a.teacher_id);
        const absentTeacherIds = teachers
            .filter(t => !attendedTeacherIds.includes(t.id))
            .map(t => ({
                teacher_id: t.id,
                date: today,
                status: 'Absent'
            }));

        if (absentTeacherIds.length > 0) {
            const { error: insertError } = await supabase
                .from('attendance')
                .insert(absentTeacherIds);

            if (insertError) throw insertError;
            console.log(`Marked ${absentTeacherIds.length} teachers absent for ${today}.`);
        } else {
            console.log('No absent teachers to mark.');
        }

    } catch (error) {
        console.error('Error running midnight cron job:', error);
    }
});
