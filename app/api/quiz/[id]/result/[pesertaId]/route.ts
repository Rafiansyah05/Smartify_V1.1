import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

function getParams(request: NextRequest, params: any) {
  const quizId = params?.id;
  const pesertaId = params?.pesertaId;

  return {
    quizId: Array.isArray(quizId) ? quizId[0] : quizId,
    pesertaId: Array.isArray(pesertaId) ? pesertaId[0] : pesertaId,
  };
}

export async function GET(request: NextRequest, context: any) {
  try {
    const { quizId, pesertaId } = getParams(request, context.params);

    if (!quizId || !pesertaId) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    // Get quiz info
    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul, durasi_menit, total_soal, tingkat_kesulitan, kkm').eq('kuis_id', quizId).single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Get participant info
    const { data: participant, error: participantError } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa, user_id').eq('peserta_id', pesertaId).eq('kuis_id', quizId).single();

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
    }

    // Get hasil_kuis
    const { data: hasil, error: hasilError } = await supabase.from('hasil_kuis').select('*').eq('peserta_id', pesertaId).single();

    // Get all questions with answers
    const { data: questions, error: questionsError } = await supabase
      .from('soal')
      .select(
        `
        soal_id,
        teks_soal,
        tipe_soal,
        poin,
        urutan,
        pilihan_jawaban (
          pilihan_id,
          teks_pilihan,
          is_benar,
          urutan
        ),
        kunci_jawaban (
          kunci_id,
          jawaban_text,
          kata_kunci
        )
      `,
      )
      .eq('kuis_id', quizId)
      .order('urutan', { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: 'Gagal mengambil soal' }, { status: 500 });
    }

    // Get student answers
    const { data: answers, error: answersError } = await supabase.from('jawaban_siswa').select('*').eq('peserta_id', pesertaId);

    if (answersError) {
      console.error('Fetch answers error:', answersError);
    }

    // Map answers to questions
    const answersMap = new Map((answers || []).map((a: any) => [a.soal_id, a]));

    const questionResults = (questions || []).map((q: any) => {
      const studentAnswer = answersMap.get(q.soal_id);
      const correctOption = q.pilihan_jawaban?.find((p: any) => p.is_benar);
      const keyAnswer = q.kunci_jawaban?.[0];

      return {
        soal_id: q.soal_id,
        teks_soal: q.teks_soal,
        tipe_soal: q.tipe_soal,
        urutan: q.urutan,
        poin_maksimal: q.poin || 10,
        pilihan: q.pilihan_jawaban?.sort((a: any, b: any) => a.urutan - b.urutan) || [],
        jawaban_benar: q.tipe_soal === 'pilihan_ganda' ? correctOption?.teks_pilihan : keyAnswer?.jawaban_text,
        penjelasan: keyAnswer?.jawaban_text || null,
        jawaban_siswa: studentAnswer?.jawaban || null,
        is_benar: studentAnswer?.is_benar ?? false,
        poin_dapat: studentAnswer?.poin_dapat ?? 0,
      };
    });

    // Calculate statistics
    const correctCount = questionResults.filter((q) => q.is_benar).length;
    const incorrectCount = questionResults.filter((q) => !q.is_benar).length;

    // Get leaderboard
    const { data: allResults, error: leaderboardError } = await supabase
      .from('hasil_kuis')
      .select(
        `
        hasil_id,
        peserta_id,
        nilai,
        peserta_kuis!inner (
          nama_siswa,
          kuis_id
        )
      `,
      )
      .eq('peserta_kuis.kuis_id', quizId)
      .eq('status_kuis', true)
      .order('nilai', { ascending: false });

    const leaderboard = (allResults || []).map((r: any, index: number) => ({
      rank: index + 1,
      peserta_id: r.peserta_id,
      nama_siswa: r.peserta_kuis?.nama_siswa || 'Unknown',
      nilai: r.nilai,
      isCurrentUser: r.peserta_id === pesertaId,
    }));

    const userRank = leaderboard.findIndex((l) => l.peserta_id === pesertaId) + 1;

    return NextResponse.json({
      quiz,
      participant: {
        ...participant,
        nilai: hasil?.nilai ?? 0,
        status_kuis: hasil?.status_kuis ?? false,
        status_remedial: hasil?.status_remedial ?? false,
        waktu_mulai: hasil?.waktu_mulai,
        waktu_selesai: hasil?.waktu_selesai,
        durasi_pengerjaan: hasil?.durasi_pengerjaan,
      },
      statistics: {
        correctCount,
        incorrectCount,
        totalQuestions: questionResults.length,
        score: hasil?.nilai ?? 0,
      },
      questionResults,
      leaderboard: leaderboard.slice(0, 10), // Top 10
      userRank,
      totalParticipants: leaderboard.length,
    });
  } catch (error: any) {
    console.error('Result API error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
