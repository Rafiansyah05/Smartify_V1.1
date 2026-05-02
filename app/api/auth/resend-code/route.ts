import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/resend';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email harus diisi' }, { status: 400 });
    }

    // Cek di temporary_registrations karena user belum ada di tabel users
    const { data: tempUser, error: tempError } = await supabase.from('temporary_registrations').select('nama').eq('email', email).single();

    if (tempError || !tempUser) {
      return NextResponse.json({ error: 'Data registrasi tidak ditemukan. Silakan registrasi ulang.' }, { status: 404 });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = new Date();
    newExpiry.setMinutes(newExpiry.getMinutes() + 15);

    // Update kode di email_verifications
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({
        code: newCode,
        expires_at: newExpiry.toISOString(),
        is_used: false,
      })
      .eq('email', email);

    if (updateError) {
      // Jika ternyata tidak ada row (harusnya ada karena temporary_registrations ada), kita bisa coba insert,
      // namun asumsikan update berhasil jika data valid
      console.error('Update verification code error:', updateError);
      return NextResponse.json({ error: 'Gagal mengupdate kode verifikasi' }, { status: 500 });
    }

    // Update juga expired_at di temporary_registrations
    await supabase
      .from('temporary_registrations')
      .update({
        expires_at: newExpiry.toISOString(),
      })
      .eq('email', email);

    await sendVerificationEmail(email, newCode, tempUser.nama);

    return NextResponse.json({
      success: true,
      message: 'Kode verifikasi baru telah dikirim',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
