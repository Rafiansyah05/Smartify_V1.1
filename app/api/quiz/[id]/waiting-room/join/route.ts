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

    const body = await request.json();
    const name = String(body.name || '').trim();
    const token = String(body.token || '').trim();

    if (!name || !token) {
      return NextResponse.json({ error: 'Nama dan token QR diperlukan' }, { status: 400 });
    }

    const { data: qrCode, error: qrError } = await supabase.from('qr_codes').select('qr_id, qr_token, qr_image_url, is_active').eq('kuis_id', quizId).eq('qr_token', token).eq('is_active', true).single();

    if (qrError || !qrCode) {
      return NextResponse.json({ error: 'QR Code tidak valid atau sudah tidak aktif' }, { status: 404 });
    }

    const { data: existingParticipant } = await supabase.from('peserta_kuis').select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizId).eq('nama_siswa', name).maybeSingle();

    if (existingParticipant) {
      return NextResponse.json({
        participant: existingParticipant,
        message: 'Peserta sudah bergabung',
      });
    }

    const { data: participantData, error: participantError } = await supabase
      .from('peserta_kuis')
      .insert({
        kuis_id: quizId,
        nama_siswa: name,
        status: 'success',
        waktu_masuk: new Date().toISOString(),
      })
      .select()
      .single();

    if (participantError) {
      console.error('Join error:', participantError);
      return NextResponse.json({ error: 'Gagal bergabung ke ruangan' }, { status: 500 });
    }

    return NextResponse.json({ participant: participantData });
  } catch (error: any) {
    console.error('Join route error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
