import { NextRequest, NextResponse } from 'next/server';
import { verifyAndCreateUser } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email dan kode verifikasi harus diisi' }, { status: 400 });
    }

    const { user } = await verifyAndCreateUser(email, code);

    return NextResponse.json({
      success: true,
      message: 'Email berhasil diverifikasi! Akun Anda telah aktif. Silakan login.',
      user: {
        email: user.email,
        nama: user.nama,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
