import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

function getRawQuizId(request: NextRequest, params: any) {
  const idFromParams = params?.id;
  if (idFromParams) {
    return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  }

  const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
  return pathnameParts[2] || null;
}

export async function GET(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const quizId = getRawQuizId(request, params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    // Convert to integer karena kuis_id di DB adalah integer
    const quizIdInt = parseInt(quizId);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
    }

    // Cek token dari cookie atau dari query parameter (untuk siswa via QR)
    let token = request.cookies.get('auth_token')?.value;
    const qrToken = request.nextUrl.searchParams.get('token');

    // Jika tidak ada token di cookie, coba gunakan qrToken sebagai fallback
    // Tapi qrToken tidak perlu diverifikasi untuk preview, hanya untuk identifikasi
    let user = null;
    if (token) {
      user = await getUserFromToken(token);
    }

    // Ambil data kuis (public data, tidak perlu auth untuk preview)
    const { data: kuis, error: kuisError } = await supabase.from('kuis').select('*').eq('kuis_id', quizIdInt).single();

    if (kuisError || !kuis) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Ambil soal
    const { data: soalList, error: soalError } = await supabase.from('soal').select('*').eq('kuis_id', quizIdInt).order('urutan', { ascending: true });

    if (soalError) throw soalError;

    // Ambil pilihan jawaban dan kunci jawaban untuk setiap soal
    const populatedSoal = await Promise.all(
      (soalList || []).map(async (soal) => {
        // Ambil pilihan jawaban (untuk pilihan ganda)
        let pilihan = [];
        if (soal.tipe_soal === 'pilihan_ganda') {
          const { data: pilihanData } = await supabase.from('pilihan_jawaban').select('*').eq('soal_id', soal.soal_id).order('urutan', { ascending: true });
          pilihan = pilihanData || [];
        }

        // Ambil kunci jawaban (penjelasan dari Gemini) untuk SEMUA tipe soal
        const { data: kunciJawaban } = await supabase.from('kunci_jawaban').select('*').eq('soal_id', soal.soal_id).maybeSingle();

        return {
          ...soal,
          pilihan: pilihan,
          kunci_jawaban: kunciJawaban || null,
        };
      }),
    );

    return NextResponse.json({
      kuis,
      soal: populatedSoal,
      pembuat: user?.nama || 'Smartify AI',
    });
  } catch (error: any) {
    console.error('Fetch quiz detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
