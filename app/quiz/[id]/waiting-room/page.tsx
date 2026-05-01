'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ParticipantCard } from '@/components/quiz/ParticipantCard';

const QR_SERVICE = 'https://api.qrserver.com/v1/create-qr-code/';

export default function WaitingRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [qrCode, setQrCode] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [joinedParticipant, setJoinedParticipant] = useState<any>(null);
  const [storedParticipant, setStoredParticipant] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [roomError, setRoomError] = useState('');

  const isTeacher = useMemo(() => user?.role === 'guru' || user?.role === 'admin', [user]);
  const studentView = !isTeacher;
  const qrUrl = useMemo(() => {
    if (!qrCode?.qr_image_url) return null;
    return `${window.location.origin}${qrCode.qr_image_url}`;
  }, [qrCode]);

  const storageKey = useMemo(() => {
    if (!id || !qrToken) return null;
    return `waiting-room-${id}-${qrToken}`;
  }, [id, qrToken]);

  const fetchRoom = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
      if (qrToken) url.searchParams.set('token', qrToken);
      const res = await fetch(url.toString(), { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error || 'Gagal memuat ruang tunggu');
        return;
      }

      setQuiz(data.quiz);
      setQrCode(data.qrCode);
      setParticipants(data.participants || []);
      setJoinedParticipant(data.joinedParticipant || storedParticipant || null);
      setUser(data.user || null);
    } catch (err) {
      setRoomError('Terjadi kesalahan saat memuat data');
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshRoom = async () => {
    setRefreshing(true);
    await fetchRoom(false);
  };

  const handleStartQuiz = async () => {
    if (!id) return;
    setStartError('');
    setStarting(true);

    try {
      const res = await fetch(`/api/quiz/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error || 'Gagal memulai kuis');
        return;
      }
      router.push(`/quiz/${id}/progress`);
    } catch (err) {
      console.error(err);
      setStartError('Terjadi kesalahan saat memulai kuis');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!storageKey) return;
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setStoredParticipant(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse stored participant', error);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loading && !isTeacher && qrToken && quiz?.status === 'ongoing') {
      router.push(`/quiz/${id}/progress`);
    }
  }, [loading, isTeacher, qrToken, quiz, id, router]);

  useEffect(() => {
    fetchRoom();
  }, [id, qrToken]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) {
      setJoinError('Nama lengkap wajib diisi');
      return;
    }
    if (!qrToken) {
      setJoinError('Token QR tidak ditemukan');
      return;
    }

    setJoinError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/quiz/${id}/waiting-room/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim(), token: qrToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Gagal bergabung ke ruangan');
        return;
      }
      setJoinedParticipant(data.participant);
      setStoredParticipant(data.participant);
      setParticipants((current) => [...current.filter((item) => item.peserta_id !== data.participant.peserta_id), data.participant]);

      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(data.participant));
      }
    } catch (err) {
      console.error(err);
      setJoinError('Terjadi kesalahan ketika bergabung');
    } finally {
      setSubmitting(false);
    }
  };

  const openQrFull = () => {
    if (!qrUrl) return;
    window.open(qrUrl, '_blank');
  };

  const downloadQrCode = async () => {
    if (!qrUrl) return;
    const imageUrl = `${QR_SERVICE}?size=360x360&data=${encodeURIComponent(qrUrl)}`;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${quiz?.judul || 'qr-code'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert('Gagal mengunduh QR code. Silakan coba lagi.');
    }
  };

  const renderJoinCard = () => (
    <div className="max-w-md mx-auto bg-card rounded-3xl shadow-sm border border-border p-8">
      <div className="flex flex-col items-center gap-4 mb-6">
        <Image src="/images/logo2.png" alt="Smartify" width={80} height={80} priority />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-card-foreground">Masuk Ruangan</h1>
          <p className="text-sm text-muted mt-2">Masukkan nama lengkap untuk bergabung ke kuis.</p>
        </div>
      </div>

      {quiz && (
        <div className="mb-6 rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">{quiz.judul}</p>
          <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="font-semibold text-gray-900">{quiz.total_soal}</p>
              <span>Soal</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="font-semibold text-gray-900">{quiz.durasi_menit}m</p>
              <span>Durasi</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="font-semibold text-gray-900 capitalize">{quiz.tingkat_kesulitan}</p>
              <span>Level</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="joinName" className="block text-sm font-medium text-[#3E484F]">
            Nama Lengkap
          </label>
          <input
            id="joinName"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Contoh: Royma Teddy"
            className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {joinError && <p className="text-sm text-red-600">{joinError}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {submitting ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full bg-card rounded-3xl border border-border p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-card-foreground mb-4">Ruangan Tidak Ditemukan</h1>
          <p className="text-sm text-muted mb-6">{roomError}</p>
          <button onClick={() => router.push('/dashboard')} className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isTeacher && !joinedParticipant && qrToken) {
    return <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">{renderJoinCard()}</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-7xl mx-auto px-4 pt-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Waiting Room</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isTeacher && (
              <button
                onClick={handleStartQuiz}
                disabled={starting || quiz?.status === 'ongoing'}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quiz?.status === 'ongoing' ? 'Kuis Sedang Berlangsung' : starting ? 'Memulai...' : 'Mulai Kuis'}
              </button>
            )}
            <button
              onClick={handleRefreshRoom}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? 'Memuat...' : 'Segarkan'}
            </button>
          </div>
        </div>
        {startError && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{startError}</div>}

        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">{quiz?.judul || 'Ulangan Harian'}</p>
                    <h1 className="text-3xl font-bold text-gray-900">Waiting Room</h1>
                  </div>
                  <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{participants.length} Siswa Bergabung</div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Jumlah Soal</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{quiz?.total_soal ?? 0}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Durasi</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{quiz?.durasi_menit ?? 0} menit</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kesulitan</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900 capitalize">{quiz?.tingkat_kesulitan || 'Medium'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-sm font-medium text-gray-500">QR Code Join</p>
                    <p className="text-xs text-gray-400">Tamu dapat scan untuk masuk ke waiting room.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs text-gray-500 rounded-full border border-gray-200 px-3 py-2">
                    <strong>Mode</strong> {isTeacher ? 'Guru' : 'Siswa'}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-6 text-center">
                  {qrUrl ? (
                    <div className="relative mx-auto w-full max-w-[260px]">
                      <img crossOrigin="anonymous" src={`${QR_SERVICE}?size=320x320&data=${encodeURIComponent(qrUrl)}`} alt="QR Code Smartify" className="mx-auto rounded-3xl border border-slate-200 bg-white" />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-white p-2 shadow-sm">
                          <Image src="/images/logo2.png" alt="Smartify" width={58} height={58} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-72 flex items-center justify-center text-sm text-gray-400">QR Code belum tersedia</div>
                  )}

                  {qrUrl && (
                    <div className="mt-6 space-y-3">
                      <div className="rounded-3xl bg-white p-4 border border-gray-100 text-left text-sm text-gray-700 break-words">
                        <p className="text-xs text-gray-400 mb-1">Link QR</p>
                        <p className="font-medium text-gray-900">{qrUrl}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button onClick={openQrFull} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors">
                          Buka Full Size
                        </button>
                        <button onClick={downloadQrCode} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                          Download QR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ruangan</p>
                    <h2 className="text-xl font-semibold text-gray-900">Daftar Siswa</h2>
                  </div>
                  <span className="text-sm text-gray-400">{participants.length} peserta</span>
                </div>

                <div className="space-y-3">
                  {participants.length > 0 ? (
                    participants.map((participant) => <ParticipantCard key={participant.peserta_id} name={participant.nama_siswa} status={participant.status} highlightName={studentView} />)
                  ) : (
                    <div className="rounded-3xl border border-dashed border-gray-200 bg-slate-50 p-6 text-center text-sm text-gray-500">Belum ada siswa yang masuk. Tunggu beberapa saat.</div>
                  )}
                </div>
              </div>

              {!isTeacher && joinedParticipant && (
                <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-500">Anda berhasil masuk ke waiting room.</p>
                  <p className="mt-4 text-gray-900 font-semibold">Silakan tunggu guru memulai kuis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
