import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { getUserFromToken } from '@/lib/auth/auth-service';

async function getParams(context: any) {
  const params = await context.params;
  const id = params?.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function POST(request: NextRequest, context: any) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await getUserFromToken(token);
    if (!user || (user.role !== 'guru' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Hanya guru yang dapat mengeluarkan siswa' }, { status: 403 });
    }

    const quizIdRaw = await getParams(context);
    const quizIdInt = parseInt(quizIdRaw);
    if (isNaN(quizIdInt)) {
      return NextResponse.json({ error: 'ID kuis tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const pesertaId = parseInt(body?.pesertaId);
    if (isNaN(pesertaId)) {
      return NextResponse.json({ error: 'pesertaId wajib' }, { status: 400 });
    }

    const { data: kuis, error: kuisErr } = await supabase.from('kuis').select('kuis_id, guru_id').eq('kuis_id', quizIdInt).maybeSingle();
    if (kuisErr || !kuis || kuis.guru_id !== user.user_id) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan atau akses ditolak' }, { status: 404 });
    }

    const { data: peserta, error: pesertaErr } = await supabase
      .from('peserta_kuis')
      .select('peserta_id, kuis_id')
      .eq('peserta_id', pesertaId)
      .eq('kuis_id', quizIdInt)
      .maybeSingle();

    if (pesertaErr || !peserta) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan di ruangan ini' }, { status: 404 });
    }

    await supabase.from('jawaban_siswa').delete().eq('peserta_id', pesertaId);
    await supabase.from('hasil_kuis').delete().eq('peserta_id', pesertaId);
    const { error: delErr } = await supabase.from('peserta_kuis').delete().eq('peserta_id', pesertaId);

    if (delErr) {
      console.error('Kick peserta error:', delErr);
      return NextResponse.json({ error: 'Gagal mengeluarkan siswa' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
