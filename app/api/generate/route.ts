import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const difficulty = formData.get('difficulty') as string;
    const totalQuestions = parseInt(formData.get('totalQuestions') as string);
    const duration = parseInt(formData.get('duration') as string);
    const kkm = parseInt(formData.get('kkm') as string);

    // Ambil jumlah spesifik untuk campuran
    const multipleChoiceCount = parseInt(formData.get('multipleChoiceCount') as string) || 0;
    const shortAnswerCount = parseInt(formData.get('shortAnswerCount') as string) || 0;

    if (!file || !title) {
      return NextResponse.json({ error: 'File dan judul wajib diisi' }, { status: 400 });
    }

    // Validasi ukuran file (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(fileBuffer).toString('base64');

    // Tetap menggunakan gemini-2.5-flash seperti yang Anda minta
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Tentukan komposisi soal
    let pilganCount = 0;
    let uraianCount = 0;

    if (type === 'pilihan_ganda') {
      pilganCount = totalQuestions;
      uraianCount = 0;
    } else if (type === 'uraian') {
      pilganCount = 0;
      uraianCount = totalQuestions;
    } else {
      pilganCount = multipleChoiceCount || Math.floor(totalQuestions / 2);
      uraianCount = shortAnswerCount || Math.ceil(totalQuestions / 2);
    }

    let prompt = `Anda adalah seorang guru ahli. Buatlah soal ujian berdasarkan dokumen yang diberikan.
Judul Kuis: ${title}
Tingkat Kesulitan: ${difficulty}
Total Soal: ${totalQuestions} (${pilganCount} soal pilihan ganda, ${uraianCount} soal isian singkat)
Jenis Soal: ${type}

Kembalikan hasil HANYA DALAM FORMAT JSON ARRAY tanpa markdown (tanpa \`\`\`json) dengan skema berikut:
[
  {
    "teks_soal": "Pertanyaan soal...",
    "tipe_soal": "pilihan_ganda",
    "pilihan": [
      { "teks": "Pilihan A", "is_benar": true },
      { "teks": "Pilihan B", "is_benar": false },
      { "teks": "Pilihan C", "is_benar": false },
      { "teks": "Pilihan D", "is_benar": false }
    ],
    "penjelasan": "Penjelasan mengapa jawaban tersebut benar..."
  },
  {
    "teks_soal": "Pertanyaan isian singkat yang jelas dan spesifik...",
    "tipe_soal": "uraian",
    "penjelasan": "Kunci jawaban singkat (hanya 1 hingga 3 kata) yang langsung menjawab pertanyaan"
  }
]

PENTING: 
1. JANGAN berikan teks apapun di luar JSON
2. JANGAN gunakan markdown seperti \`\`\`json
3. Langsung berikan array JSON
4. Untuk soal uraian (isian singkat), jawaban di field "penjelasan" WAJIB sangat singkat, maksimal 1-3 kata saja.
5. Buat kalimat soal yang profesional dan objektif secara langsung. DILARANG KERAS menggunakan kalimat pengantar seperti "Berdasarkan modul...", "Menurut materi di atas...", atau sejenisnya. Uji pemahaman konsep secara langsung layaknya soal ujian sesungguhnya.`;

    console.log('Mengirim request ke Gemini dengan model gemini-2.5-flash...');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf',
        },
      },
    ]);

    const textResult = result.response.text();
    console.log('Response dari Gemini diterima, length:', textResult.length);

    // Parsing JSON dengan lebih aman
    let questionsData;
    try {
      let cleanJson = textResult;

      // Hapus markdown code blocks
      cleanJson = cleanJson.replace(/```json\n?/gi, '');
      cleanJson = cleanJson.replace(/```\n?/gi, '');
      cleanJson = cleanJson.trim();

      // Cari array JSON (mulai dengan [ dan diakhiri ])
      const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        cleanJson = arrayMatch[0];
      }

      questionsData = JSON.parse(cleanJson);

      if (!Array.isArray(questionsData) || questionsData.length === 0) {
        throw new Error('Response bukan array yang valid');
      }

      console.log(`Berhasil parse ${questionsData.length} soal`);
    } catch (e) {
      console.error('Failed to parse AI response:', textResult.substring(0, 500));
      return NextResponse.json(
        {
          error: 'Gagal memproses respons dari AI. Silakan coba lagi.',
          detail: textResult.substring(0, 200),
        },
        { status: 500 },
      );
    }

    // Batasi jumlah soal sesuai yang diminta
    const maxQuestions = Math.min(questionsData.length, totalQuestions);
    console.log(`Menyimpan ${maxQuestions} dari ${questionsData.length} soal`);

    // 1. Simpan ke tabel kuis
    const kodeKuis = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: kuisData, error: kuisError } = await supabase
      .from('kuis')
      .insert({
        guru_id: user.user_id,
        judul: title,
        deskripsi: 'Generated by Smartify AI',
        jenis_soal: type,
        tingkat_kesulitan: difficulty,
        durasi_menit: duration,
        kkm: kkm,
        jumlah_pilgan: pilganCount,
        jumlah_uraian: uraianCount,
        total_soal: maxQuestions,
        status: 'draft',
        kode_kuis: kodeKuis,
      })
      .select()
      .single();

    if (kuisError || !kuisData) {
      console.error('Error insert kuis:', kuisError);
      return NextResponse.json({ error: 'Gagal menyimpan kuis ke database: ' + kuisError?.message }, { status: 500 });
    }

    const kuisId = kuisData.kuis_id;
    console.log(`Kuis created with ID: ${kuisId}`);

    // 2. Simpan setiap soal dan pilihannya
    let savedCount = 0;
    for (let i = 0; i < maxQuestions; i++) {
      const q = questionsData[i];

      // Validasi tipe soal
      const tipeSoal = q.tipe_soal === 'pilihan_ganda' || q.tipe_soal === 'pilihan_ganda' ? 'pilihan_ganda' : 'uraian';

      const { data: soalData, error: soalError } = await supabase
        .from('soal')
        .insert({
          kuis_id: kuisId,
          teks_soal: q.teks_soal,
          tipe_soal: tipeSoal,
          poin: 10,
          urutan: i + 1,
        })
        .select()
        .single();

      if (soalError) {
        console.error('Error insert soal:', soalError);
        continue;
      }

      const soalId = soalData.soal_id;

      if (q.tipe_soal === 'pilihan_ganda' && q.pilihan && Array.isArray(q.pilihan)) {
        // Simpan pilihan jawaban
        const pilihanToInsert = q.pilihan.map((p: any, idx: number) => ({
          soal_id: soalId,
          teks_pilihan: p.teks.replace(/^[A-D]\.\s*/, ''), // Hapus A., B., dll jika ada
          is_benar: p.is_benar === true,
          urutan: idx + 1,
        }));

        const { error: pilihanError } = await supabase.from('pilihan_jawaban').insert(pilihanToInsert);
        if (pilihanError) {
          console.error('Error insert pilihan:', pilihanError);
        }

        // Simpan penjelasan jika ada
        if (q.penjelasan) {
          await supabase.from('kunci_jawaban').insert({
            soal_id: soalId,
            jawaban_text: q.penjelasan,
            kata_kunci: [],
          });
        }
        savedCount++;
      } else if (q.tipe_soal === 'uraian') {
        // Untuk soal uraian, gunakan penjelasan atau buat default
        const jawabanText = q.penjelasan || q.kunci_jawaban_essay || 'Jawaban akan dinilai oleh guru.';

        const { error: kunciError } = await supabase.from('kunci_jawaban').insert({
          soal_id: soalId,
          jawaban_text: jawabanText,
          kata_kunci: [],
        });

        if (kunciError) {
          console.error('Error insert kunci jawaban:', kunciError);
        }
        savedCount++;
      }
    }

    console.log(`Success: ${savedCount} soal tersimpan dari ${maxQuestions} yang diproses`);

    return NextResponse.json({ success: true, quizId: kuisId });
  } catch (error: any) {
    console.error('API Generate Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Terjadi kesalahan pada server',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
