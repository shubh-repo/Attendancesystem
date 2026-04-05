import { supabase } from './src/config/supabase.js';

async function testCheckout() {
    try {
        const teacher_id = "d183b789-0705-4014-8a2e-d917eb1768a9"; // from the db
        const today = "2026-03-07"; // matches date
        
        const { data: existing, error: existError } = await supabase
            .from('attendance')
            .select('*')
            .eq('teacher_id', teacher_id)
            .eq('date', today)
            .single();

        console.log("Existing record fetched:", existing);
        
        let finalStatus = 'Half Day';
        const currentTime = "00:10:43";
        const out_photo_url = "https://...";
        
        let updateResult;
        let finalMessage = 'Check-Out successful';

        try {
            updateResult = await supabase
                .from('attendance')
                .update({ out_time: currentTime, out_photo_url, status: finalStatus })
                .eq('id', existing.id)
                .select()
                .single();
            if (updateResult.error) throw updateResult.error;
            
            console.log("Update SUCCESS:", updateResult.data);
        } catch (dbError) {
            console.log("Caught update error:", dbError.code, dbError.message);
            if (dbError.code === '22P02') {
                console.warn('DB Enum missing Half Day/Early Leave. Falling back to existing status.');
                updateResult = await supabase
                    .from('attendance')
                    .update({ out_time: currentTime, out_photo_url, status: existing.status })
                    .eq('id', existing.id)
                    .select()
                    .single();
                
                if (updateResult.error) throw updateResult.error;
                console.log("Fallback SUCCESS:", updateResult.data);
            } else {
                throw dbError; // rethrow other errors
            }
        }
    } catch (error) {
        console.error("Test failed top level", error);
    }
}
testCheckout();
