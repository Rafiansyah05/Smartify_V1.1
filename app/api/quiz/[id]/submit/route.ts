import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function getRawQuizId(request: NextRequest, context: any) {
  const params = await context.params;
  const idFromParams = params?.id;
  if (idFromParams) {
    return Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  }
  const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
  return pathnameParts[2] || null;
}

async function gradeEssay(studentAnswer: string, keyAnswer: string, questionText: string): Promise<{ score: number; feedback: string }> {
  try {
    if (!studentAnswer || studentAnswer.trim() === '') {
      return { score: 0, feedback: 'Jawaban tidak diisi.' };
    }
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });
    const prompt = `Anda adalah seorang guru yang objektif dalam menilai isian singkat siswa.

INPUT:
Soal: ${questionText}
Kunci Jawaban: ${keyAnswer}
Jawaban Pengguna: ${studentAnswer}

LANGKAH PENILAIAN:
1. Identifikasi poin-poin penting dari kunci jawaban.
2. Bandingkan jawaban pengguna dengan poin-poin tersebut. Beri nilai untuk setiap poin yang sesuai (gunakan pendekatan makna/semantic, bukan harus kata yang persis sama).
3. Jika poin disebutkan sebagian → beri nilai parsial. Jika tidak disebutkan → nilai 0.

KRITERIA PENILAIAN (Skala 0-10):
9–10 → Sangat lengkap (semua poin utama + tambahan)
7–8 → Lengkap (sebagian besar poin utama ada)
5–6 → Cukup (hanya setengah poin)
3–4 → Kurang (sedikit poin benar)
0–2 → Tidak sesuai

ATURAN TAMBAHAN:
- Jangan terlalu ketat pada wording, fokus pada makna
- Jawaban singkat tetap bisa mendapat nilai tinggi jika mencakup inti
- Hindari penilaian subjektif, fokus pada kecocokan isi

Berikan penilaian HANYA dalam format JSON murni:
{
  "score": <angka 0-10>,
  "feedback": "Poin yang sudah benar: ..., Poin yang belum: ..., Saran: ..."
}`;
    const result = await model.generateContent(prompt);
    const textResult = result.response.text();
    const grading = JSON.parse(textResult);
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
    const quizId = await getRawQuizId(request, context);
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

    // Validasi peserta
    const { data: pesertaExists, error: pesertaError } = await supabase.from('peserta_kuis').select('peserta_id, nama_siswa, status').eq('peserta_id', pesertaId).maybeSingle();
    if (pesertaError || !pesertaExists) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 });
    }

    // Cegah double submit
    if (pesertaExists.status === 'selesai') {
      const { data: existingHasil } = await supabase.from('hasil_kuis').select('nilai, status_lulus, status_remedial, durasi_pengerjaan').eq('peserta_id', pesertaId).maybeSingle();
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        result: { pesertaId, nilai: existingHasil?.nilai || 0, statusRemedial: existingHasil?.status_remedial || false, durasiPengerjaan: existingHasil?.durasi_pengerjaan || 0 },
        weakAnswers: [],
      });
    }

    console.log('Processing submission for:', pesertaExists.nama_siswa);

    // Ambil quiz info
    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, tingkat_kesulitan, kkm').eq('kuis_id', quizIdInt).single();
    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    // Ambil semua soal
    const { data: questions, error: questionsError } = await supabase.from('soal').select('*').eq('kuis_id', quizIdInt);
    if (questionsError || !questions) {
      return NextResponse.json({ error: 'Gagal mengambil soal' }, { status: 500 });
    }

    // Batch ambil pilihan_jawaban dan kunci_jawaban
    const soalIds = questions.map((q) => q.soal_id);
    const { data: allPilihan } = await supabase.from('pilihan_jawaban').select('*').in('soal_id', soalIds);
    const { data: allKunci } = await supabase.from('kunci_jawaban').select('*').in('soal_id', soalIds);

    const pilihanMap = new Map<number, any[]>();
    (allPilihan || []).forEach((p) => {
      if (!pilihanMap.has(p.soal_id)) pilihanMap.set(p.soal_id, []);
      pilihanMap.get(p.soal_id)!.push(p);
    });
    const kunciMap = new Map<number, any>();
    (allKunci || []).forEach((k) => kunciMap.set(k.soal_id, k));

    const questionsWithDetails = questions.map((q) => ({
      ...q,
      pilihan_jawaban: pilihanMap.get(q.soal_id) || [],
      kunci_jawaban: kunciMap.get(q.soal_id) || null,
    }));

    const submitTime = new Date();
    let totalScore = 0;
    let totalPossiblePoints = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    const jawabanRecords: any[] = [];
    const weakAnswers: any[] = [];

    for (const question of questionsWithDetails) {
      const studentAnswer = answers[question.soal_id];
      const maxPoinSoal = 10; // Seperti yang Anda minta: poin paten 10
      totalPossiblePoints += maxPoinSoal;

      let isCorrect = false;
      let pointsEarned = 0;
      let correctAnswerText = '';

      if (question.tipe_soal === 'pilihan_ganda') {
        const correctOption = question.pilihan_jawaban?.find((p: any) => p.is_benar);
        correctAnswerText = correctOption?.teks_pilihan || '';
        
        if (studentAnswer && studentAnswer === correctAnswerText) {
          isCorrect = true;
          pointsEarned = 10;
          correctCount++;
        } else {
          incorrectCount++;
          pointsEarned = 0;
        }

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
        } else {
          const grading = await gradeEssay(studentAnswer, keyAnswer, question.teks_soal);
          
          let parsedScore = parseFloat(grading.score as any) || 0;
          // Antisipasi jika AI halusinasi memberikan skala 0-100 walau diminta 0-10
          if (parsedScore > 10) {
            parsedScore = (parsedScore / 100) * 10;
          }
          parsedScore = Math.min(10, Math.max(0, parsedScore));
          
          pointsEarned = Number(parsedScore.toFixed(2));
          if (pointsEarned >= 6) {
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

    let finalScore = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
    finalScore = Math.min(100, Math.max(0, finalScore)); // Cap at 100
    finalScore = Number(finalScore.toFixed(2)); // Decimal 2 places

    // === LOGGING SAVE JAWABAN ===
    console.log('📝 Jawaban records to save:', jawabanRecords.length);
    console.log('📊 Total score:', totalScore, 'from', totalPossiblePoints);

    // Hapus dahulu jika ada submission sebelumnya (mencegah duplicate constraint tanpa onConflict)
    await supabase.from('jawaban_siswa').delete().eq('peserta_id', pesertaId);

    const { error: jawabanError } = await supabase.from('jawaban_siswa').insert(jawabanRecords);

    if (jawabanError) {
      console.error('❌ Save answers error:', jawabanError);
    } else {
      console.log('✅ Jawaban berhasil disimpan:', jawabanRecords.length, 'records');
    }

    // Ambil waktu mulai dan pastikan timezone UTC agar tidak terjadi offset jam
    const { data: hasilExisting } = await supabase.from('hasil_kuis').select('waktu_mulai').eq('peserta_id', pesertaId).maybeSingle();

    let waktuMulaiStr = hasilExisting?.waktu_mulai;
    if (waktuMulaiStr && !waktuMulaiStr.endsWith('Z') && !waktuMulaiStr.includes('+')) {
      waktuMulaiStr += 'Z';
    }
    const waktuMulai = waktuMulaiStr ? new Date(waktuMulaiStr) : submitTime;
    const durasiPengerjaan = Math.max(0, Math.round((submitTime.getTime() - waktuMulai.getTime()) / 1000));

    // Update hasil_kuis (karena sudah di-insert saat start/mulai, kita cukup update saja)
    const { error: hasilError } = await supabase.from('hasil_kuis').update({
      nilai: finalScore,
      status_lulus: finalScore >= (quiz.kkm || 70),
      status_remedial: finalScore < (quiz.kkm || 70),
      waktu_selesai: submitTime.toISOString(),
      durasi_pengerjaan: durasiPengerjaan,
    }).eq('peserta_id', pesertaId);

    if (hasilError) {
      console.error('Update hasil_kuis error:', hasilError);
    }

    // Update status peserta
    const { error: pesertaUpdateError } = await supabase.from('peserta_kuis').update({ status: 'selesai' }).eq('peserta_id', pesertaId);

    if (pesertaUpdateError) {
      console.error('Update peserta status error:', pesertaUpdateError);
    }

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
      weakAnswers,
    });
  } catch (error: any) {
    console.error('Submit quiz error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
