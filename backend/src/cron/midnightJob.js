import { supabase } from '../config/supabase.js';

// Cron job to run at 23:59 daily
import cron from 'node-cron';

// Execute every day at 11:59 PM
cron.schedule('59 23 * * *', async () => {
    console.log('Running midnight cron job for missing attendance...');
    try {
        const todayDateStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
        const [today] = todayDateStr.split(' ');

        // Exclude Sundays — use Intl to get correct IST weekday (avoids UTC/IST mismatch)
        const istDayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date());
        if (istDayName === 'Sun') {
            console.log('Today is Sunday. No automated absent marks will be placed.');
            return;
        }

        // Exclude declared holidays
        const { data: holiday } = await supabase.from('holidays').select('id, name').eq('date', today).maybeSingle();
        if (holiday) {
            console.log(`Today (${today}) is a holiday: "${holiday.name}". Skipping absent marks.`);
            return;
        }

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
