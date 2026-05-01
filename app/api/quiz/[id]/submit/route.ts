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

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  mudah: 1.0,
  sedang: 1.2,
  sulit: 1.5,
  easy: 1.0,
  medium: 1.2,
  hard: 1.5,
};

async function gradeEssay(studentAnswer: string, keyAnswer: string, questionText: string): Promise<{ score: number; feedback: string }> {
  try {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return { score: 0, feedback: 'Jawaban tidak diisi.' };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Anda adalah seorang guru yang menilai jawaban essay siswa.

Soal: ${questionText}

Kunci Jawaban / Jawaban yang Diharapkan:
${keyAnswer}

Jawaban Siswa:
${studentAnswer}

Berikan penilaian dalam format JSON (tanpa markdown):
{
  "score": <nilai 0-100>,
  "feedback": "<penjelasan singkat mengapa nilai tersebut diberikan>"
}`;

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
    return { score: 50, feedback: 'Penilaian otomatis, guru akan memeriksa ulang.' };
  }
}

export async function POST(request: NextRequest, context: any) {
  try {
    const quizId = getRawQuizId(request, context.params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const quizIdInt = parseInt(quizId);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
    }

    const body = await request.json();
    const { pesertaId, answers } = body;

    if (!pesertaId || !answers) {
      return NextResponse.json({ error: 'pesertaId dan answers wajib diisi' }, { status: 400 });
    }

    // Get quiz info
    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, tingkat_kesulitan, kkm').eq('kuis_id', quizIdInt).single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Get all questions with their correct answers
    const { data: questions, error: questionsError } = await supabase.from('soal').select('*').eq('kuis_id', quizIdInt);

    if (questionsError || !questions) {
      return NextResponse.json({ error: 'Gagal mengambil soal' }, { status: 500 });
    }

    // Get pilihan jawaban for each question
    const questionsWithDetails = await Promise.all(
      questions.map(async (question) => {
        // Get pilihan jawaban
        const { data: pilihan } = await supabase.from('pilihan_jawaban').select('*').eq('soal_id', question.soal_id);

        // Get kunci jawaban
        const { data: kunci } = await supabase.from('kunci_jawaban').select('*').eq('soal_id', question.soal_id).maybeSingle();

        return {
          ...question,
          pilihan_jawaban: pilihan || [],
          kunci_jawaban: kunci,
        };
      }),
    );

    const submitTime = new Date();
    let totalScore = 0;
    let totalPossiblePoints = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    const difficulty = quiz.tingkat_kesulitan?.toLowerCase() || 'medium';
    const multiplier = DIFFICULTY_MULTIPLIER[difficulty] || 1.2;

    const jawabanRecords: any[] = [];
    const weakAnswers: any[] = []; // Untuk AI recommendations

    // Process each question
    for (const question of questionsWithDetails) {
      const studentAnswer = answers[question.soal_id];
      const basePoin = question.poin || 10;
      const weightedPoin = basePoin * multiplier;
      totalPossiblePoints += weightedPoin;

      let isCorrect = false;
      let pointsEarned = 0;
      let feedback = '';
      let correctAnswerText = '';

      if (question.tipe_soal === 'pilihan_ganda') {
        const correctOption = question.pilihan_jawaban?.find((p: any) => p.is_benar);
        correctAnswerText = correctOption?.teks_pilihan || '';

        if (studentAnswer === correctAnswerText) {
          isCorrect = true;
          pointsEarned = weightedPoin;
          correctCount++;
          feedback = 'Jawaban benar!';
        } else {
          incorrectCount++;
          feedback = `Jawaban salah.`;
        }

        const explanation = question.kunci_jawaban?.jawaban_text;
        if (explanation) {
          feedback += ` Penjelasan: ${explanation}`;
        }

        // Track wrong answers for AI
        if (!isCorrect) {
          weakAnswers.push({
            teks_soal: question.teks_soal,
            jawaban_siswa: studentAnswer || '',
            jawaban_benar: correctAnswerText,
            konsep: question.kunci_jawaban?.jawaban_text || '',
          });
        }
      } else if (question.tipe_soal === 'uraian') {
        const kunci = question.kunci_jawaban;
        const keyAnswer = kunci?.jawaban_text || '';
        correctAnswerText = keyAnswer;

        if (!studentAnswer || studentAnswer.trim() === '') {
          pointsEarned = 0;
          incorrectCount++;
          feedback = 'Jawaban tidak diisi.';
        } else {
          const grading = await gradeEssay(studentAnswer, keyAnswer, question.teks_soal);
          pointsEarned = (grading.score / 100) * weightedPoin;
          feedback = grading.feedback;

          if (grading.score >= 60) {
            correctCount++;
            isCorrect = true;
          } else {
            incorrectCount++;
            weakAnswers.push({
              teks_soal: question.teks_soal,
              jawaban_siswa: studentAnswer,
              jawaban_benar: keyAnswer,
              konsep: kunci?.jawaban_text || '',
            });
          }
        }
      }

      totalScore += pointsEarned;

      jawabanRecords.push({
        peserta_id: pesertaId,
        soal_id: question.soal_id,
        jawaban: studentAnswer || '',
        is_benar: isCorrect,
        waktu_jawab: submitTime.toISOString(),
        poin_dapat: pointsEarned,
      });
    }

    // Calculate final score (normalized to 100)
    const finalScore = totalPossiblePoints > 0 ? Math.round((totalScore / totalPossiblePoints) * 100) : 0;

    // Save all student answers
    const { error: jawabanError } = await supabase.from('jawaban_siswa').upsert(jawabanRecords, { onConflict: 'peserta_id,soal_id' });

    if (jawabanError) {
      console.error('Save answers error:', jawabanError);
    }

    // Get waktu_mulai from hasil_kuis
    const { data: hasilExisting } = await supabase.from('hasil_kuis').select('waktu_mulai').eq('peserta_id', pesertaId).maybeSingle();

    const waktuMulai = hasilExisting?.waktu_mulai ? new Date(hasilExisting.waktu_mulai) : submitTime;
    const durasiPengerjaan = Math.round((submitTime.getTime() - waktuMulai.getTime()) / 1000);

    // Update hasil_kuis
    const { error: hasilError } = await supabase.from('hasil_kuis').upsert(
      {
        peserta_id: pesertaId,
        nilai: finalScore,
        status_lulus: finalScore >= (quiz.kkm || 70),
        status_remedial: finalScore < (quiz.kkm || 70),
        waktu_mulai: waktuMulai.toISOString(),
        waktu_selesai: submitTime.toISOString(),
        durasi_pengerjaan: durasiPengerjaan,
      },
      { onConflict: 'peserta_id' },
    );

    if (hasilError) {
      console.error('Update hasil_kuis error:', hasilError);
    }

    // Update peserta_kuis status
    await supabase.from('peserta_kuis').update({ status: 'selesai' }).eq('peserta_id', pesertaId);

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
      },
      weakAnswers, // Send weak answers for AI recommendations
    });
  } catch (error: any) {
    console.error('Submit quiz error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
