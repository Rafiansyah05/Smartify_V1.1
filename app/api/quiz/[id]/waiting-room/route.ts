import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

function generateQrToken() {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
}

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
    const user = token ? await getUserFromToken(token) : null;

    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul, tingkat_kesulitan, durasi_menit, total_soal, status, guru_id').eq('kuis_id', quizId).single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    const { data: qrCodes } = await supabase.from('qr_codes').select('qr_id, qr_token, qr_image_url, is_active, created_at').eq('kuis_id', quizId).order('created_at', { ascending: false }).limit(1);

    const { data: participants } = await supabase.from('peserta_kuis').select('peserta_id, kuis_id, user_id, nama_siswa, status, waktu_masuk').eq('kuis_id', quizId).order('waktu_masuk', { ascending: true });

    return NextResponse.json({
      quiz,
      qrCode: qrCodes?.[0] || null,
      participants: participants || [],
      joinedParticipant: null,
      user,
    });
  } catch (error: any) {
    console.error('Waiting room GET error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: any) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quizId = getRawQuizId(request, context.params);
    if (!quizId) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const { data: quiz, error: quizError } = await supabase.from('kuis').select('kuis_id, judul').eq('kuis_id', quizId).single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan' }, { status: 404 });
    }

    await supabase.from('qr_codes').update({ is_active: false }).eq('kuis_id', quizId).eq('is_active', true);

    const rawId = getRawQuizId(request, context.params);
    const qrToken = generateQrToken();
    const qrPath = `/quiz/${rawId}/waiting-room?token=${qrToken}`;
    const { data: qrData, error: qrError } = await supabase
      .from('qr_codes')
      .insert({
        kuis_id: quizId,
        qr_token: qrToken,
        qr_image_url: qrPath,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qrError) {
      console.error('QR insert error:', qrError);
      return NextResponse.json({ error: 'Gagal membuat QR Code' }, { status: 500 });
    }

    await supabase.from('kuis').update({ status: 'published' }).eq('kuis_id', quizId);

    return NextResponse.json({ success: true, qrCode: qrData, quiz });
  } catch (error: any) {
    console.error('Waiting room POST error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
