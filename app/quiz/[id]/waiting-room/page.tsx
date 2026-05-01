'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Bell, MoreVertical, RefreshCw } from 'lucide-react';

const QR_SERVICE = 'https://api.qrserver.com/v1/create-qr-code/';

interface Participant {
  peserta_id: string;
  nama_siswa: string;
  status: 'connecting' | 'success' | string;
}

export default function WaitingRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [qrCode, setQrCode] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joinedParticipant, setJoinedParticipant] = useState<any>(null);
  const [storedParticipant, setStoredParticipant] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startError, setStartError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
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
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
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
    if (!loading && !isTeacher && qrToken && quiz?.status === 'ongoing' && joinedParticipant) {
      // Store participant info for the take page
      const participantData = {
        ...joinedParticipant,
        quizStartTime: new Date().toISOString(),
      };
      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(participantData));
      }
      router.push(`/quiz/${id}/take?token=${qrToken}`);
    }
  }, [loading, isTeacher, qrToken, quiz, id, router, joinedParticipant, storageKey]);

  useEffect(() => {
    fetchRoom();
  }, [id, qrToken]);

  // Auto-polling for students: check every 3 seconds if quiz has started
  useEffect(() => {
    if (loading || isTeacher || !qrToken || !joinedParticipant) return;
    if (quiz?.status === 'ongoing') return; // Already redirecting

    const pollInterval = setInterval(() => {
      fetchRoom(false);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [loading, isTeacher, qrToken, joinedParticipant, quiz?.status]);

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

  const getInitials = (name?: string) => {
    if (!name) return 'UN';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
      case 'mudah':
        return 'text-emerald-500';
      case 'medium':
      case 'sedang':
        return 'text-amber-500';
      case 'hard':
      case 'sulit':
        return 'text-red-500';
      default:
        return 'text-emerald-500';
    }
  };

  const renderJoinCard = () => (
    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <div className="flex flex-col items-center gap-4 mb-6">
        <Image src="/images/logo2.png" alt="Smartify" width={80} height={80} priority />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Masuk Ruangan</h1>
          <p className="text-sm text-gray-500 mt-2">Masukkan nama lengkap untuk bergabung ke kuis.</p>
        </div>
      </div>

      {quiz && (
        <div className="mb-6 rounded-2xl bg-gray-50 p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">{quiz.judul}</p>
          <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
            <div className="rounded-xl bg-white p-3 text-center border border-gray-100">
              <p className="font-semibold text-gray-900">{quiz.total_soal}</p>
              <span className="text-xs">Soal</span>
            </div>
            <div className="rounded-xl bg-white p-3 text-center border border-gray-100">
              <p className="font-semibold text-gray-900">{quiz.durasi_menit}m</p>
              <span className="text-xs">Durasi</span>
            </div>
            <div className="rounded-xl bg-white p-3 text-center border border-gray-100">
              <p className={`font-semibold capitalize ${getDifficultyColor(quiz.tingkat_kesulitan)}`}>{quiz.tingkat_kesulitan}</p>
              <span className="text-xs">Level</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="joinName" className="block text-sm font-medium text-gray-700">
            Nama Lengkap
          </label>
          <input
            id="joinName"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Contoh: Royma Teddy"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          />
        </div>

        {joinError && <p className="text-sm text-red-600">{joinError}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50">
          {submitting ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );

  // Student Waiting View - after joined
  const renderStudentWaitingView = () => (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-lg">Back to Home</span>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchRoom(false)} disabled={refreshing || loading} className="p-2.5 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2.5 rounded-full hover:bg-gray-50 transition-colors">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Breadcrumb & Title */}
          <div className="mb-8">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              GENERATE QUIZ {'>'} PREVIEW {'>'} WAITING ROOM
            </p>
            <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
          </div>

          {/* Quiz Info */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">QUESTIONS</p>
              <p className="text-2xl font-bold text-gray-800">{quiz?.total_soal || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">TIME LIMIT</p>
              <p className="text-2xl font-bold text-gray-800">{quiz?.durasi_menit || 0}m</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">DIFFICULTY</p>
              <p className={`text-2xl font-bold capitalize ${getDifficultyColor(quiz?.tingkat_kesulitan)}`}>{quiz?.tingkat_kesulitan || 'Medium'}</p>
            </div>
          </div>

          {/* Student List */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{participants.length} Siswa Bergabung</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {participants.map((participant) => (
                <div key={participant.peserta_id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{participant.nama_siswa}</p>
                    <span className={`text-xs ${participant.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>{participant.status === 'success' ? 'Ready' : 'Connecting...'}</span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Waiting Message */}
          <div className="bg-cyan-50 rounded-xl p-6 text-center border border-cyan-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-cyan-800 font-medium">Anda telah bergabung sebagai {joinedParticipant?.nama_siswa}</p>
            <p className="text-cyan-600 text-sm mt-2">Silakan tunggu guru memulai kuis...</p>
            <p className="text-cyan-500 text-xs mt-1">Halaman akan otomatis berpindah saat kuis dimulai</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Teacher View
  const renderTeacherView = () => (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-lg">Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
            <button onClick={() => fetchRoom(false)} disabled={refreshing || loading} className="p-2.5 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2.5 rounded-full hover:bg-gray-50 transition-colors">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>

            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 hover:border-cyan-400 transition-colors">
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center font-medium text-sm">{getInitials(user?.nama)}</div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{user?.nama || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
                  </div>
                  <button onClick={handleLogout} className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-50 transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Breadcrumb & Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                GENERATE QUIZ {'>'} PREVIEW {'>'} WAITING ROOM
              </p>
              <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
            </div>

            <div className="flex items-center gap-6">
              {/* Quiz Stats */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-gray-400">QUESTIONS</p>
                  <p className="text-xl font-bold text-gray-800">{quiz?.total_soal || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-gray-400">TIME LIMIT</p>
                  <p className="text-xl font-bold text-gray-800">{quiz?.durasi_menit || 0}m</p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-gray-400">DIFFICULTY</p>
                  <p className={`text-xl font-bold capitalize ${getDifficultyColor(quiz?.tingkat_kesulitan)}`}>{quiz?.tingkat_kesulitan || 'Medium'}</p>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartQuiz}
                disabled={starting || quiz?.status === 'ongoing'}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quiz?.status === 'ongoing' ? 'Kuis Berlangsung' : starting ? 'Memulai...' : 'Mulai Kuis Sekarang!'}
              </button>
            </div>
          </div>

          {startError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{startError}</div>}

          {/* Main Content */}
          <div className="grid lg:grid-cols-[300px_1fr] gap-8">
            {/* QR Code Section */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-center">
                {qrUrl ? (
                  <div className="relative mx-auto w-full max-w-[220px]">
                    <img crossOrigin="anonymous" src={`${QR_SERVICE}?size=280x280&data=${encodeURIComponent(qrUrl)}`} alt="QR Code Smartify" className="mx-auto rounded-2xl border border-gray-200 bg-white" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-white p-1.5 shadow-sm">
                        <Image src="/images/logo2.png" alt="Smartify" width={40} height={40} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-2xl">QR Code belum tersedia</div>
                )}

                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h3 className="font-semibold text-gray-800">Scan to Join</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Open your camera
                    <br />
                    to join the lobby instantly.
                  </p>

                  <button onClick={openQrFull} className="mt-4 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Buka QR
                  </button>
                </div>
              </div>
            </div>

            {/* Participants Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">{participants.length} Siswa Bergabung</h2>

              {participants.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {participants.map((participant) => (
                    <div key={participant.peserta_id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{participant.nama_siswa}</p>
                        <span className={`text-xs ${participant.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>{participant.status === 'success' ? 'Ready' : 'Connecting...'}</span>
                      </div>
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                  <p className="text-gray-500">Belum ada siswa yang bergabung.</p>
                  <p className="text-sm text-gray-400 mt-1">Bagikan QR code untuk mengundang siswa.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Ruangan Tidak Ditemukan</h1>
          <p className="text-sm text-gray-500 mb-6">{roomError}</p>
          <button onClick={() => router.push('/dashboard')} className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Student without joining yet
  if (!isTeacher && !joinedParticipant && qrToken) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">{renderJoinCard()}</div>;
  }

  // Student already joined
  if (!isTeacher && joinedParticipant) {
    return renderStudentWaitingView();
  }

  // Teacher view
  return renderTeacherView();
}
