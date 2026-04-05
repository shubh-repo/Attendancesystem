import { supabase } from './src/config/supabase.js';
import fs from 'fs';

async function test() {
    const { data, error } = await supabase.from('attendance').select('*').limit(1);
    fs.writeFileSync('db-columns.json', JSON.stringify(data?.[0] || {}, null, 2), 'utf8');
}
test();
