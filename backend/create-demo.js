import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function createDemoTeacher() {
    const mobile = '9876543210';

    // check if it exists
    const { data: existing } = await supabase.from('teachers').select('*').eq('mobile', mobile).single();
    if (existing) {
        console.log('Demo teacher already exists:', existing);
        return;
    }

    const { data, error } = await supabase
        .from('teachers')
        .insert([{
            name: 'Demo Teacher',
            mobile: mobile,
            designation: 'Demo Subject',
            joining_date: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        console.error('Failed to create demo teacher', error);
    } else {
        console.log('Demo teacher created successfully:', data);
        console.log('\\n--- USE THESE CREDENTIALS FOR TEACHER LOGIN ---');
        console.log('Mobile/ID: 9876543210');
        console.log('Passcode: (Any 8 digit number)');
        console.log('-------------------------------------------------\\n');
    }
}

createDemoTeacher();
