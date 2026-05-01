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

    const quizIdInt = parseInt(quizId);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
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
    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul, durasi_menit, total_soal, status, tingkat_kesulitan, kkm, created_at').eq('kuis_id', quizIdInt).single();

    if (quizError || !quiz) {
      console.error('Quiz not found:', quizError);
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Get total questions for this quiz
    const { count: totalQuestions, error: countError } = await supabase.from('soal').select('soal_id', { count: 'exact', head: true }).eq('kuis_id', quizIdInt);

    if (countError) {
      console.error('Error counting questions:', countError);
    }

    // Get all participants with their results
    const { data: participants, error: participantsError } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizIdInt);

    if (participantsError) {
      console.error('Fetch participants error:', participantsError);
      return NextResponse.json({ error: 'Gagal mengambil data peserta' }, { status: 500 });
    }

    // Get semua jawaban dan hasil untuk setiap participant
    const participantsWithProgress = await Promise.all(
      (participants || []).map(async (p: any) => {
        // Get result for this participant
        const { data: hasil } = await supabase.from('hasil_kuis').select('*').eq('peserta_id', p.peserta_id).maybeSingle();

        // Get semua jawaban siswa untuk hitung poin
        const { data: jawabanList } = await supabase.from('jawaban_siswa').select('*').eq('peserta_id', p.peserta_id);

        const answeredCount = jawabanList?.length || 0;

        // Hitung total poin yang didapat dari jawaban yang sudah dijawab
        let totalPointsEarned = 0;
        if (jawabanList && jawabanList.length > 0) {
          totalPointsEarned = jawabanList.reduce((sum, j) => sum + (j.poin_dapat || 0), 0);
        }

        // Hitung total poin maksimal untuk soal yang sudah dijawab
        // Untuk menentukan status "ongoing" apakah sudah selesai semua atau belum
        const isCompleted = hasil?.waktu_selesai !== null || p.status === 'selesai';

        // Nilai akhir jika sudah selesai, atau nilai sementara jika masih mengerjakan
        let currentScore = null;
        if (isCompleted && hasil?.nilai !== null) {
          currentScore = hasil.nilai;
        } else if (totalPointsEarned > 0 && totalQuestions) {
          // Hitung nilai sementara berdasarkan poin yang sudah didapat
          // Asumsi total poin maksimal per soal adalah 10 (default)
          const maxPossiblePoints = totalQuestions * 10;
          currentScore = maxPossiblePoints > 0 ? Math.round((totalPointsEarned / maxPossiblePoints) * 100) : 0;
        }

        // Hitung durasi pengerjaan (dari pertama kali quiz dimulai)
        let durasiPengerjaan = hasil?.durasi_pengerjaan || null;
        if (!isCompleted && hasil?.waktu_mulai) {
          const startTime = new Date(hasil.waktu_mulai);
          const now = new Date();
          durasiPengerjaan = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        }

        return {
          peserta_id: p.peserta_id,
          nama_siswa: p.nama_siswa,
          status: isCompleted ? 'selesai' : 'sedang_mengerjakan',
          waktu_masuk: p.waktu_masuk,
          nilai: currentScore,
          status_remedial: hasil?.status_remedial ?? null,
          status_lulus: hasil?.status_lulus ?? false,
          waktu_mulai: hasil?.waktu_mulai ?? null,
          waktu_selesai: hasil?.waktu_selesai ?? null,
          durasi_pengerjaan: durasiPengerjaan,
          answered_count: answeredCount,
          total_questions: totalQuestions || 0,
          progress_percent: totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0,
          total_points_earned: totalPointsEarned,
        };
      }),
    );

    // Sort participants: yang nilai tertinggi di atas, yang masih mengerjakan di bawah
    const sortedParticipants = participantsWithProgress.sort((a, b) => {
      // Yang sudah selesai dan nilai lebih tinggi di atas
      if (a.status === 'selesai' && b.status === 'selesai') {
        return (b.nilai || 0) - (a.nilai || 0);
      }
      // Yang sudah selesai di atas yang masih mengerjakan
      if (a.status === 'selesai' && b.status !== 'selesai') return -1;
      if (a.status !== 'selesai' && b.status === 'selesai') return 1;
      // Yang masih mengerjakan: berdasarkan progress (answered_count)
      return (b.answered_count || 0) - (a.answered_count || 0);
    });

    // Calculate statistics
    const completedParticipants = participantsWithProgress.filter((p) => p.status === 'selesai');
    const inProgressParticipants = participantsWithProgress.filter((p) => p.status === 'sedang_mengerjakan');

    const completedScores = completedParticipants.map((p) => p.nilai).filter((n): n is number => n !== null);

    const avgScore = completedScores.length > 0 ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length) : 0;
    const highestScore = completedScores.length > 0 ? Math.max(...completedScores) : 0;
    const lowestScore = completedScores.length > 0 ? Math.min(...completedScores) : 0;
    const passedCount = completedParticipants.filter((p) => (p.nilai ?? 0) >= (quiz.kkm || 70)).length;

    return NextResponse.json({
      quiz: {
        ...quiz,
        total_questions: totalQuestions || 0,
      },
      participants: sortedParticipants,
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
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
