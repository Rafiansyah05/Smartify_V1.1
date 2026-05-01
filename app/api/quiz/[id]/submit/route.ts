import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getRawQuizId(request: NextRequest, params: any) {
  const idFromParams = params?.id;
  if (idFromParams) {
    return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  }
  const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
  return pathnameParts[2] || null;
}

// Difficulty multipliers for scoring
const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  mudah: 1.0,
  sedang: 1.2,
  sulit: 1.5,
  easy: 1.0,
  medium: 1.2,
  hard: 1.5,
};

// Grade essay using Gemini
async function gradeEssay(
  studentAnswer: string,
  keyAnswer: string,
  questionText: string
): Promise<{ score: number; feedback: string }> {
  try {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return { score: 0, feedback: 'Jawaban tidak diisi.' };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Anda adalah seorang guru yang menilai jawaban essay siswa.

Soal: ${questionText}

Kunci Jawaban / Jawaban yang Diharapkan:
${keyAnswer}

Jawaban Siswa:
${studentAnswer}

Berikan penilaian dalam format JSON (tanpa markdown):
{
  "score": <nilai 0-100>,
  "feedback": "<penjelasan singkat mengapa nilai tersebut diberikan, termasuk apa yang benar dan apa yang kurang>"
}

Kriteria penilaian:
- 100: Jawaban sempurna, mencakup semua poin kunci
- 80-99: Jawaban sangat baik, mungkin ada sedikit kekurangan
- 60-79: Jawaban cukup baik, ada beberapa poin yang terlewat
- 40-59: Jawaban kurang lengkap tapi ada ide yang benar
- 20-39: Jawaban minimal, hanya menyentuh beberapa aspek
- 0-19: Jawaban tidak relevan atau salah total`;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text();

    const cleanJson = textResult
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();
    const grading = JSON.parse(cleanJson);

    return {
      score: Math.min(100, Math.max(0, grading.score || 0)),
      feedback: grading.feedback || 'Tidak ada feedback',
    };
  } catch (error) {
    console.error('Essay grading error:', error);
    // Fallback: simple keyword matching
    const keyWords = keyAnswer.toLowerCase().split(/\s+/);
    const answerWords = studentAnswer.toLowerCase().split(/\s+/);
    const matchCount = keyWords.filter((kw) =>
      answerWords.some((aw) => aw.includes(kw) || kw.includes(aw))
    ).length;
    const matchRatio = matchCount / keyWords.length;
    const fallbackScore = Math.round(matchRatio * 100);

    return {
      score: fallbackScore,
      feedback: 'Penilaian otomatis berdasarkan kecocokan kata kunci.',
    };
  }
}

export async function POST(request: NextRequest, context: any) {
  try {
    const quizId = getRawQuizId(request, context.params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const { pesertaId, answers } = body;

    if (!pesertaId || !answers) {
      return NextResponse.json(
        { error: 'pesertaId dan answers wajib diisi' },
        { status: 400 }
      );
    }

    // Get quiz info
    const { data: quiz, error: quizError } = await supabase
      .from('kuis')
      .select('kuis_id, tingkat_kesulitan, kkm')
      .eq('kuis_id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Get all questions with their correct answers
    const { data: questions, error: questionsError } = await supabase
      .from('soal')
      .select(
        `
        soal_id,
        teks_soal,
        tipe_soal,
        poin,
        pilihan_jawaban (
          pilihan_id,
          teks_pilihan,
          is_benar
        ),
        kunci_jawaban (
          kunci_id,
          jawaban_text,
          kata_kunci
        )
      `
      )
      .eq('kuis_id', quizId);

    if (questionsError || !questions) {
      return NextResponse.json(
        { error: 'Gagal mengambil soal' },
        { status: 500 }
      );
    }

    const submitTime = new Date();
    let totalScore = 0;
    let totalPossiblePoints = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    const difficulty = quiz.tingkat_kesulitan?.toLowerCase() || 'sedang';
    const multiplier = DIFFICULTY_MULTIPLIER[difficulty] || 1.0;

    const jawabanRecords: any[] = [];
    const questionResults: any[] = [];

    // Process each question
    for (const question of questions) {
      const studentAnswer = answers[question.soal_id];
      const basePoin = question.poin || 10;
      const weightedPoin = basePoin * multiplier;
      totalPossiblePoints += weightedPoin;

      let isCorrect = false;
      let pointsEarned = 0;
      let feedback = '';

      if (question.tipe_soal === 'pilihan_ganda') {
        // Multiple choice grading
        const correctOption = question.pilihan_jawaban?.find(
          (p: any) => p.is_benar
        );
        const correctText = correctOption?.teks_pilihan || '';

        if (studentAnswer === correctText) {
          isCorrect = true;
          pointsEarned = weightedPoin;
          correctCount++;
          feedback = 'Jawaban benar!';
        } else {
          incorrectCount++;
          feedback = `Jawaban salah. Jawaban yang benar: ${correctText}`;
        }

        // Get explanation from kunci_jawaban if exists
        const kunci = question.kunci_jawaban?.[0];
        if (kunci?.jawaban_text) {
          feedback += ` Penjelasan: ${kunci.jawaban_text}`;
        }
      } else if (question.tipe_soal === 'uraian') {
        // Essay grading using Gemini
        const kunci = question.kunci_jawaban?.[0];
        const keyAnswer = kunci?.jawaban_text || '';

        if (!studentAnswer || studentAnswer.trim() === '') {
          pointsEarned = 0;
          incorrectCount++;
          feedback = 'Jawaban tidak diisi.';
        } else {
          const grading = await gradeEssay(
            studentAnswer,
            keyAnswer,
            question.teks_soal
          );
          // Convert 0-100 score to weighted points
          pointsEarned = (grading.score / 100) * weightedPoin;
          feedback = grading.feedback;

          if (grading.score >= 60) {
            correctCount++;
            isCorrect = true;
          } else {
            incorrectCount++;
          }
        }
      }

      totalScore += pointsEarned;

      // Prepare jawaban record
      jawabanRecords.push({
        peserta_id: pesertaId,
        soal_id: question.soal_id,
        jawaban: studentAnswer || '',
        is_benar: isCorrect,
        waktu_jawab: submitTime.toISOString(),
        poin_dapat: pointsEarned,
      });

      // Store result for response
      questionResults.push({
        soal_id: question.soal_id,
        teks_soal: question.teks_soal,
        tipe_soal: question.tipe_soal,
        jawaban_siswa: studentAnswer || '',
        is_benar: isCorrect,
        poin_dapat: pointsEarned,
        poin_maksimal: weightedPoin,
        feedback,
        jawaban_benar:
          question.tipe_soal === 'pilihan_ganda'
            ? question.pilihan_jawaban?.find((p: any) => p.is_benar)?.teks_pilihan
            : question.kunci_jawaban?.[0]?.jawaban_text,
      });
    }

    // Calculate final score (normalized to 100)
    const finalScore =
      totalPossiblePoints > 0
        ? Math.round((totalScore / totalPossiblePoints) * 100)
        : 0;

    // Save all student answers
    const { error: jawabanError } = await supabase
      .from('jawaban_siswa')
      .upsert(jawabanRecords, {
        onConflict: 'peserta_id,soal_id',
      });

    if (jawabanError) {
      console.error('Save answers error:', jawabanError);
    }

    // Get waktu_mulai from hasil_kuis
    const { data: hasilExisting } = await supabase
      .from('hasil_kuis')
      .select('waktu_mulai')
      .eq('peserta_id', pesertaId)
      .single();

    const waktuMulai = hasilExisting?.waktu_mulai
      ? new Date(hasilExisting.waktu_mulai)
      : submitTime;
    const durasiPengerjaan = Math.round(
      (submitTime.getTime() - waktuMulai.getTime()) / 1000
    );

    // Update hasil_kuis
    const { error: hasilError } = await supabase
      .from('hasil_kuis')
      .upsert(
        {
          peserta_id: pesertaId,
          nilai: finalScore,
          status_kuis: true, // completed
          status_remedial: finalScore < (quiz.kkm || 70),
          waktu_mulai: waktuMulai.toISOString(),
          waktu_selesai: submitTime.toISOString(),
          durasi_pengerjaan: durasiPengerjaan,
        },
        { onConflict: 'peserta_id' }
      );

    if (hasilError) {
      console.error('Update hasil_kuis error:', hasilError);
    }

    // Update peserta_kuis status
    await supabase
      .from('peserta_kuis')
      .update({ status: 'selesai' })
      .eq('peserta_id', pesertaId);

    return NextResponse.json({
      success: true,
      result: {
        pesertaId,
        nilai: finalScore,
        correctCount,
        incorrectCount,
        totalQuestions: questions.length,
        statusRemedial: finalScore < (quiz.kkm || 70),
        durasiPengerjaan,
        questionResults,
      },
    });
  } catch (error: any) {
    console.error('Submit quiz error:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}
