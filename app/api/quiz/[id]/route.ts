import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

export async function GET(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const { id } = params;
    
    // Auth Check
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ambil data kuis
    const { data: kuis, error: kuisError } = await supabase
      .from('kuis')
      .select('*')
      .eq('kuis_id', id)
      .single();

    if (kuisError || !kuis) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Ambil soal
    const { data: soalList, error: soalError } = await supabase
      .from('soal')
      .select('*')
      .eq('kuis_id', id)
      .order('urutan', { ascending: true });

    if (soalError) throw soalError;

    // Ambil pilihan jawaban dan kunci jawaban untuk setiap soal
    const populatedSoal = await Promise.all(soalList.map(async (soal) => {
      if (soal.tipe_soal === 'pilihan_ganda') {
        const { data: pilihan } = await supabase
          .from('pilihan_jawaban')
          .select('*')
          .eq('soal_id', soal.soal_id)
          .order('urutan', { ascending: true });
        
        return { ...soal, pilihan: pilihan || [] };
      } else {
        const { data: kunci } = await supabase
          .from('kunci_jawaban')
          .select('*')
          .eq('soal_id', soal.soal_id)
          .single();
        
        return { ...soal, kunci_jawaban: kunci };
      }
    }));

    return NextResponse.json({ kuis, soal: populatedSoal, pembuat: user.nama });
  } catch (error: any) {
    console.error('Fetch quiz detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
