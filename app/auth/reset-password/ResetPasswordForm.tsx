'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/footer/footer';
import { LockIcon, EyeIcon, EyeOffIcon, CheckCircle2 } from 'lucide-react';
import { broadcastPasswordResetComplete, onPasswordResetComplete } from '@/lib/auth/password-reset-broadcast';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    return onPasswordResetComplete(() => {
      router.replace('/auth/login');
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      broadcastPasswordResetComplete();
      setShowSuccessModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    setShowSuccessModal(false);
    router.replace('/auth/login');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-card rounded-2xl shadow-sm p-8 md:p-10 text-center">
              <div className="flex flex-col items-center mb-6">
                <Image src="/images/logo_smartify.png" alt="Logo" width={120} height={40} priority />
              </div>
              <div className="border-t border-border mb-6" />
              <h1 className="text-xl font-bold text-card-foreground mb-3">Tautan tidak valid</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Halaman ini memerlukan tautan atur ulang password dari email Anda. Minta tautan baru dari halaman lupa password.
              </p>
              <Link href="/auth/forgot-password" className="inline-block w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors">
                Minta tautan reset
              </Link>
              <p className="text-center text-card-foreground mt-6 text-sm">
                <Link href="/auth/login" className="text-primary font-medium hover:underline">
                  Kembali ke masuk
                </Link>
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-card rounded-2xl shadow-sm p-8 md:p-10">
            <div className="flex flex-col items-center mb-6">
              <Image src="/images/logo_smartify.png" alt="Logo" width={120} height={40} priority />
            </div>

            <div className="border-t border-border mb-6" />

            <h1 className="text-2xl font-bold text-card-foreground text-center mb-2">Password baru</h1>
            <p className="text-center text-muted-foreground text-sm mb-8">Buat password baru untuk akun Anda. Minimal 6 karakter.</p>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[#3E484F]">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockIcon className="h-5 w-5 text-muted" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    {showPassword ? <EyeOffIcon className="h-5 w-5 text-muted" /> : <EyeIcon className="h-5 w-5 text-muted" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#3E484F]">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockIcon className="h-5 w-5 text-muted" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    {showConfirmPassword ? <EyeOffIcon className="h-5 w-5 text-muted" /> : <EyeIcon className="h-5 w-5 text-muted" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan password'}
              </button>
            </form>

            <p className="text-center text-card-foreground mt-6 text-sm">
              <Link href="/auth/login" className="text-primary font-medium hover:underline">
                Kembali ke masuk
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-border">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground mb-2">Password berhasil diubah</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Password akun Anda telah diperbarui. Silakan masuk menggunakan password baru. Di perangkat lain, sesi lama telah diakhiri demi keamanan.
            </p>
            <button type="button" onClick={goToLogin} className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors">
              Masuk ke halaman login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
