import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { weakAnswers, quizTitle } = await request.json();

    if (!weakAnswers || weakAnswers.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // Format weak answers untuk prompt Gemini
    const weakQuestionsText = weakAnswers
      .map((item: any, idx: number) => {
        return `${idx + 1}. Soal: ${item.teks_soal}\n   Jawaban Siswa: ${item.jawaban_siswa}\n   Jawaban Benar: ${item.jawaban_benar}\n   Konsep yang terkait: ${item.konsep || 'Tidak disebutkan'}`;
      })
      .join('\n\n');

    const prompt = `Anda adalah asisten AI yang membantu siswa belajar. Berdasarkan hasil quiz "${quizTitle}", siswa menjawab salah pada soal-soal berikut:

${weakQuestionsText}

Tugas Anda:
1. Identifikasi TOPIK/MATERI utama yang belum dikuasai siswa dari soal-soal tersebut (maksimal 3 topik)
2. Berikan rekomendasi belajar yang spesifik untuk setiap topik

Format response HARUS berupa JSON array dengan structure:
[
  {
    "materi": "nama materi/topik",
    "rekomendasi": "penjelasan singkat tentang materi ini dan saran belajar yang spesifik (maksimal 2 kalimat)"
  }
]

Gunakan bahasa Indonesia yang santai namun informatif. Jangan terlalu panjang.`;

    // Panggil API Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
    });

    const data = await response.json();
    let recommendationsText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Clean up response (remove markdown code blocks)
    recommendationsText = recommendationsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const recommendations = JSON.parse(recommendationsText);

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error('AI Recommendation error:', error);
    return NextResponse.json({ recommendations: [], error: error.message }, { status: 500 });
  }
}
