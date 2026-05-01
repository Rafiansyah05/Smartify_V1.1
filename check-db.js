const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseServiceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseServiceKey = supabaseServiceKeyMatch ? supabaseServiceKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: kuisList } = await supabase.from('kuis').select('*').order('kuis_id', { ascending: false }).limit(1);
  if (!kuisList || kuisList.length === 0) {
    console.log("No quiz found");
    return;
  }
  const kuisId = kuisList[0].kuis_id;
  console.log("Checking Quiz ID:", kuisId);

  const { data: soal } = await supabase.from('soal').select('*').eq('kuis_id', kuisId);
  console.log(`Found ${soal.length} soal. Tipe:`, soal.map(s => s.tipe_soal));

  if (soal.length > 0) {
    const testSoalId = soal[0].soal_id;
    console.log("Testing insert to kunci_jawaban with soal_id:", testSoalId);
    const { data: insData, error: insErr } = await supabase.from('kunci_jawaban').insert({
      soal_id: testSoalId,
      jawaban_text: 'Test Penjelasan',
      kata_kunci: ['Test Kata Kunci']
    }).select();
    console.log("Insert result:", insData);
    if (insErr) console.error("Insert error:", insErr);
  }
}

run();
