const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseServiceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseServiceKey = supabaseServiceKeyMatch ? supabaseServiceKeyMatch[1].trim() : '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    const quizId = 8;
    console.log('--- QR CODES ---');
    const qr = await supabase.from('qr_codes').select('*').eq('kuis_id', quizId).order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(qr, null, 2));

    console.log('--- PESERTA ---');
    const p = await supabase.from('peserta_kuis').select('*').eq('kuis_id', quizId).order('waktu_masuk', { ascending: true }).limit(20);
    console.log(JSON.stringify(p, null, 2));

    console.log('--- TRY INSERT ---');
    const ins = await supabase.from('peserta_kuis').insert({ kuis_id: quizId, nama_siswa: 'Test Siswa', status: 'success', waktu_masuk: new Date().toISOString(), qr_token: 'RVWR1CAAB1' }).select().single();
    console.log(JSON.stringify(ins, null, 2));
  } catch (error) {
    console.error(error);
  }
})();
