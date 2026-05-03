import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase/client';
import { supabaseServer } from '../supabase/server';

const JWT_SECRET = process.env.JWT_SECRET!;

// STEP 1: Initiate Registration
export async function initiateRegistration(email: string, password: string, nama: string) {
  try {
    // Cek apakah email sudah terdaftar di users
    const { data: existingUser } = await supabase.from('users').select('email').eq('email', email).single();

    if (existingUser) {
      throw new Error('Email sudah terdaftar');
    }

    // Hapus data temporary lama yang expired
    await supabaseServer.from('temporary_registrations').delete().lt('expires_at', new Date().toISOString());

    // Cek apakah sudah ada pending registration
    const { data: existingTemp } = await supabaseServer.from('temporary_registrations').select('*').eq('email', email).single();

    if (existingTemp) {
      await supabaseServer.from('temporary_registrations').delete().eq('email', email);
    }

    // Hapus email_verifications lama
    await supabaseServer.from('email_verifications').delete().eq('email', email);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Simpan ke temporary_registrations
    const tempExpiresAt = new Date();
    tempExpiresAt.setMinutes(tempExpiresAt.getMinutes() + 15);

    const { error: tempError } = await supabaseServer.from('temporary_registrations').insert({
      email,
      password_hash: passwordHash,
      nama,
      expires_at: tempExpiresAt.toISOString(),
    });

    if (tempError) {
      console.error('Temporary registration error:', tempError);
      throw new Error('Gagal menyimpan data sementara: ' + tempError.message);
    }

    // Simpan ke email_verifications
    const { error: verifError } = await supabaseServer.from('email_verifications').insert({
      email,
      code: verificationCode,
      expires_at: expiresAt.toISOString(),
      is_used: false,
    });

    if (verifError) {
      console.error('Email verification error:', verifError);
      throw new Error('Gagal menyimpan data verifikasi: ' + verifError.message);
    }

    return { verificationCode, expiresAt };
  } catch (error: any) {
    console.error('Initiate registration error:', error);
    throw error;
  }
}

// STEP 2: Verify Email and Create User
export async function verifyAndCreateUser(code: string, email?: string) {
  try {
    // Cek kode verifikasi. Jika email tidak dikirim, cari berdasarkan kode aktif terbaru.
    let verificationQuery = supabaseServer.from('email_verifications').select('*').eq('code', code).eq('is_used', false);
    if (email) {
      verificationQuery = verificationQuery.eq('email', email);
    }

    const { data: verificationRows, error: verifError } = await verificationQuery.order('created_at', { ascending: false }).limit(2);

    if (verifError || !verificationRows || verificationRows.length === 0) {
      throw new Error('Kode verifikasi tidak valid');
    }

    if (!email && verificationRows.length > 1) {
      throw new Error('Ditemukan lebih dari satu data untuk kode ini. Silakan ulangi kirim kode verifikasi.');
    }

    const verification = verificationRows[0];
    const verifiedEmail = verification.email;

    const now = new Date();
    let verifExpiresStr = verification.expires_at;
    if (typeof verifExpiresStr === 'string' && !verifExpiresStr.endsWith('Z') && !verifExpiresStr.includes('+')) {
      verifExpiresStr += 'Z';
    }
    const expiresAt = new Date(verifExpiresStr);

    if (now > expiresAt) {
      throw new Error('Kode verifikasi sudah kadaluarsa');
    }

    // Ambil data temporary
    const { data: tempData, error: tempError } = await supabaseServer.from('temporary_registrations').select('*').eq('email', verifiedEmail).single();

    if (tempError || !tempData) {
      throw new Error('Data registrasi tidak ditemukan. Silakan registrasi ulang.');
    }

    // Cek expired
    let tempExpiresStr = tempData.expires_at;
    if (typeof tempExpiresStr === 'string' && !tempExpiresStr.endsWith('Z') && !tempExpiresStr.includes('+')) {
      tempExpiresStr += 'Z';
    }
    if (new Date(tempExpiresStr) < now) {
      throw new Error('Data registrasi sudah kadaluarsa. Silakan registrasi ulang.');
    }

    // Insert ke users
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: verifiedEmail,
        password_hash: tempData.password_hash,
        nama: tempData.nama,
        role: 'guru',
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      throw new Error('Gagal membuat akun: ' + userError.message);
    }

    // Update verification as used
    await supabaseServer.from('email_verifications').update({ is_used: true }).eq('id', verification.id);

    // Hapus temporary data
    await supabaseServer.from('temporary_registrations').delete().eq('email', verifiedEmail);

    return { user: newUser };
  } catch (error: any) {
    console.error('Verify and create user error:', error);
    throw error;
  }
}

// STEP 3: Login
export async function loginUser(email: string, password: string, rememberMe: boolean = false) {
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();

    if (error || !user) {
      throw new Error('Email atau password salah');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Email atau password salah');
    }

    // Create session token
    const token = jwt.sign({ userId: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '1d' });

    // Delete old sessions
    await supabase.from('user_sessions').delete().eq('user_id', user.user_id);

    // Store new session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 1));

    await supabase.from('user_sessions').insert({
      user_id: user.user_id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    return {
      user: {
        user_id: user.user_id,
        email: user.email,
        nama: user.nama,
        role: user.role,
        avatar_url: user.avatar_url,
      },
      token,
    };
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
}

// Get User from Token
export async function getUserFromToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

    const { data: user } = await supabase.from('users').select('user_id, email, nama, role, avatar_url').eq('user_id', decoded.userId).single();

    return user;
  } catch {
    return null;
  }
}

// Logout
export async function logoutUser(token: string) {
  await supabase.from('user_sessions').delete().eq('token', token);
}
