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

export async function POST(request: NextRequest, context: any) {
  try {
    const quizId = getRawQuizId(request, context.params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: quiz, error: quizError } = await supabase
      .from('kuis')
      .select('kuis_id, durasi_menit')
      .eq('kuis_id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    const startTime = new Date();

    // Update quiz status to ongoing
    const { error: updateError } = await supabase
      .from('kuis')
      .update({ status: 'ongoing' })
      .eq('kuis_id', quizId);

    if (updateError) {
      console.error('Start quiz error:', updateError);
      return NextResponse.json({ error: 'Gagal memulai kuis' }, { status: 500 });
    }

    // Get all participants who joined the waiting room
    const { data: participants, error: participantsError } = await supabase
      .from('peserta_kuis')
      .select('peserta_id, user_id, nama_siswa')
      .eq('kuis_id', quizId);

    if (participantsError) {
      console.error('Fetch participants error:', participantsError);
    }

    // Initialize hasil_kuis records for all participants
    if (participants && participants.length > 0) {
      const hasilKuisRecords = participants.map((p) => ({
        peserta_id: p.peserta_id,
        nilai: 0,
        status_kuis: false, // not completed yet
        status_remedial: false,
        waktu_mulai: startTime.toISOString(),
        waktu_selesai: null,
        durasi_pengerjaan: null,
      }));

      const { error: hasilError } = await supabase
        .from('hasil_kuis')
        .upsert(hasilKuisRecords, { onConflict: 'peserta_id' });

      if (hasilError) {
        console.error('Initialize hasil_kuis error:', hasilError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      startTime: startTime.toISOString(),
      duration: quiz.durasi_menit 
    });
  } catch (error: any) {
    console.error('Start quiz route error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
