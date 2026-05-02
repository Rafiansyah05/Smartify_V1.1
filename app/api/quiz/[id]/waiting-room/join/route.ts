import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest, context: any) {
  try {
    const { id } = context.params || {};
    let rawId = Array.isArray(id) ? id[0] : id;
    if (!rawId) {
      const pathnameParts = request.nextUrl.pathname.split('/').filter(Boolean);
      rawId = pathnameParts[2] || null;
    }
    if (!rawId || rawId === '') {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const quizId = /^[0-9]+$/.test(rawId) ? Number(rawId) : rawId;
    if (typeof quizId !== 'number') {
      return NextResponse.json({ error: 'ID kuis harus berupa angka' }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    const token = String(body.token || '').trim();

    if (!name || !token) {
      return NextResponse.json({ error: 'Nama dan token QR diperlukan' }, { status: 400 });
    }

    // Validasi QR code
    const { data: qrCode, error: qrError } = await supabase.from('qr_codes').select('qr_id, qr_token, qr_image_url, is_active').eq('kuis_id', quizId).eq('qr_token', token).eq('is_active', true).single();

    if (qrError || !qrCode) {
      return NextResponse.json({ error: 'QR Code tidak valid atau sudah tidak aktif' }, { status: 404 });
    }

    // Cek apakah peserta sudah bergabung
    const { data: existingParticipant } = await supabase.from('peserta_kuis').select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizId).eq('nama_siswa', name).maybeSingle();

    if (existingParticipant) {
      // Jika sudah ada, kembalikan data yang sudah ada
      return NextResponse.json({
        participant: existingParticipant,
        message: 'Peserta sudah bergabung',
      });
    }

    // Cek apakah ada peserta dengan nama yang sama tapi sudah selesai
    const { data: completedParticipant } = await supabase.from('peserta_kuis').select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizId).eq('nama_siswa', name).eq('status', 'selesai').maybeSingle();

    if (completedParticipant) {
      return NextResponse.json(
        {
          error: 'Nama sudah digunakan dan telah menyelesaikan kuis. Silakan gunakan nama lain.',
        },
        { status: 400 },
      );
    }

    // 🔥 PERUBAHAN: Status awal 'waiting' (bukan 'success')
    const { data: participantData, error: participantError } = await supabase
      .from('peserta_kuis')
      .insert({
        kuis_id: quizId,
        nama_siswa: name,
        status: 'waiting', // <-- DULU 'success', SEKARANG 'waiting'
        waktu_masuk: new Date().toISOString(),
      })
      .select()
      .single();

    if (participantError) {
      console.error('Join error:', participantError);
      return NextResponse.json({ error: 'Gagal bergabung ke ruangan' }, { status: 500 });
    }

    // 🔥 PERUBAHAN: Inisialisasi hasil_kuis dengan waktu_mulai
    const { error: hasilError } = await supabase.from('hasil_kuis').upsert(
      {
        peserta_id: participantData.peserta_id,
        nilai: 0,
        status_lulus: false,
        status_remedial: false,
        waktu_mulai: new Date().toISOString(),
        waktu_selesai: null,
        durasi_pengerjaan: 0,
      },
      { onConflict: 'peserta_id' },
    );

    if (hasilError) {
      console.error('Init hasil_kuis error:', hasilError);
    }

    const sessionId = Buffer.from(`${participantData.peserta_id}-${Date.now()}`).toString('base64');

    // 🔥 PERUBAHAN: Status yang dikirim ke frontend adalah 'waiting'
    return NextResponse.json({
      participant: {
        ...participantData,
        status: 'waiting',
      },
      sessionId: sessionId,
    });
  } catch (error: any) {
    console.error('Join route error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
