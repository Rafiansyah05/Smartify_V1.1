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

    // Get quiz info
    const { data: quiz, error: quizError } = await supabase
      .from('kuis')
      .select('kuis_id, judul, durasi_menit, total_soal, status, tingkat_kesulitan, kkm')
      .eq('kuis_id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Get all participants with their results
    const { data: participants, error: participantsError } = await supabase
      .from('peserta_kuis')
      .select(`
        peserta_id,
        nama_siswa,
        status,
        waktu_masuk,
        hasil_kuis (
          hasil_id,
          nilai,
          status_kuis,
          status_remedial,
          waktu_mulai,
          waktu_selesai,
          durasi_pengerjaan
        )
      `)
      .eq('kuis_id', quizId)
      .order('waktu_masuk', { ascending: true });

    if (participantsError) {
      console.error('Fetch participants error:', participantsError);
      return NextResponse.json({ error: 'Gagal mengambil data peserta' }, { status: 500 });
    }

    // Get total questions for this quiz
    const { count: totalQuestions } = await supabase
      .from('soal')
      .select('soal_id', { count: 'exact', head: true })
      .eq('kuis_id', quizId);

    // Get answer progress for each participant
    const participantsWithProgress = await Promise.all(
      (participants || []).map(async (p: any) => {
        // Count answered questions
        const { count: answeredCount } = await supabase
          .from('jawaban_siswa')
          .select('jawaban_id', { count: 'exact', head: true })
          .eq('peserta_id', p.peserta_id);

        const hasil = p.hasil_kuis?.[0] || null;
        const isCompleted = hasil?.status_kuis === true || p.status === 'selesai';

        return {
          peserta_id: p.peserta_id,
          nama_siswa: p.nama_siswa,
          status: isCompleted ? 'selesai' : 'sedang_mengerjakan',
          waktu_masuk: p.waktu_masuk,
          nilai: hasil?.nilai ?? null,
          status_remedial: hasil?.status_remedial ?? null,
          waktu_mulai: hasil?.waktu_mulai ?? null,
          waktu_selesai: hasil?.waktu_selesai ?? null,
          durasi_pengerjaan: hasil?.durasi_pengerjaan ?? null,
          answered_count: answeredCount || 0,
          total_questions: totalQuestions || 0,
          progress_percent: totalQuestions 
            ? Math.round(((answeredCount || 0) / totalQuestions) * 100) 
            : 0,
        };
      })
    );

    // Calculate statistics
    const completedParticipants = participantsWithProgress.filter(
      (p) => p.status === 'selesai'
    );
    const inProgressParticipants = participantsWithProgress.filter(
      (p) => p.status === 'sedang_mengerjakan'
    );

    const completedScores = completedParticipants
      .map((p) => p.nilai)
      .filter((n): n is number => n !== null);

    const avgScore =
      completedScores.length > 0
        ? Math.round(
            completedScores.reduce((a, b) => a + b, 0) / completedScores.length
          )
        : 0;

    const highestScore = completedScores.length > 0 ? Math.max(...completedScores) : 0;
    const lowestScore = completedScores.length > 0 ? Math.min(...completedScores) : 0;

    const passedCount = completedParticipants.filter(
      (p) => (p.nilai ?? 0) >= (quiz.kkm || 70)
    ).length;

    return NextResponse.json({
      quiz: {
        ...quiz,
        total_questions: totalQuestions,
      },
      participants: participantsWithProgress,
      statistics: {
        totalParticipants: participantsWithProgress.length,
        completedCount: completedParticipants.length,
        inProgressCount: inProgressParticipants.length,
        avgScore,
        highestScore,
        lowestScore,
        passedCount,
        failedCount: completedParticipants.length - passedCount,
      },
    });
  } catch (error: any) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}
