'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { MoreVertical, RefreshCw, Users, Clock, FileText, Award } from 'lucide-react';
import { Navbar } from '@/components/dashboard/Navbar';
import { supabase } from '@/lib/supabase/client';

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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startError, setStartError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);

  const hasRedirectedRef = useRef(false);
  const channelRef = useRef<any>(null);

  const isTeacher = useMemo(() => user?.role === 'guru' || user?.role === 'admin', [user]);
  const qrUrl = useMemo(() => {
    if (!qrCode?.qr_image_url) return null;
    return `${window.location.origin}${qrCode.qr_image_url}`;
  }, [qrCode]);

  // === STORAGE KEYS ===
  const getParticipantStorageKey = useCallback(() => `quiz-participant-${id}`, [id]);
  const getWaitingRoomStorageKey = useCallback(() => `waiting-room-${id}-${qrToken}`, [id, qrToken]);

  // === SAVE PARTICIPANT (STABLE) ===
  const saveParticipantToStorage = useCallback(
    (participantData: any) => {
      if (typeof window === 'undefined') return false;
      try {
        localStorage.setItem(getParticipantStorageKey(), JSON.stringify(participantData));
        if (qrToken) localStorage.setItem(getWaitingRoomStorageKey(), JSON.stringify(participantData));
        sessionStorage.setItem(`quiz-session-${id}`, JSON.stringify(participantData));
        return true;
      } catch (err) {
        console.error('Failed to save participant:', err);
        return false;
      }
    },
    [id, getParticipantStorageKey, getWaitingRoomStorageKey, qrToken],
  );

  // === LOAD PARTICIPANT (STABLE) ===
  const loadParticipantFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const sources = [
      { key: getParticipantStorageKey(), type: 'localStorage' },
      { key: getWaitingRoomStorageKey(), type: 'localStorage' },
      { key: `quiz-session-${id}`, type: 'sessionStorage' },
    ];
    for (const source of sources) {
      try {
        const stored = source.type === 'localStorage' ? localStorage.getItem(source.key) : sessionStorage.getItem(source.key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.peserta_id) return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  }, [id, getParticipantStorageKey, getWaitingRoomStorageKey]);

  // === REDIRECT TO TAKE QUIZ (STABLE) ===
  const redirectToTakeQuiz = useCallback(() => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    let participantToUse = joinedParticipant;
    if (!participantToUse?.peserta_id) {
      participantToUse = loadParticipantFromStorage();
    }

    if (participantToUse?.peserta_id) {
      saveParticipantToStorage({ ...participantToUse, quizStartTime: new Date().toISOString() });
      const tokenToUse = qrToken || participantToUse.qrToken || '';
      router.push(`/quiz/${id}/take?token=${tokenToUse}`);
    } else {
      hasRedirectedRef.current = false;
    }
  }, [joinedParticipant, loadParticipantFromStorage, saveParticipantToStorage, router, id, qrToken]);

  // === AUTO REDIRECT EFFECT IF ALREADY ONGOING ===
  useEffect(() => {
    if (quiz?.status === 'ongoing' && !isTeacher && !hasRedirectedRef.current) {
      console.log('🚀 Quiz is already ongoing, redirecting student immediately...');
      redirectToTakeQuiz();
    }
  }, [quiz?.status, isTeacher, redirectToTakeQuiz]);

  // === FETCH ROOM DATA ===
  const fetchRoom = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        else setRefreshing(true);

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
        setUser(data.user || null);
      } catch (err) {
        setRoomError('Terjadi kesalahan saat memuat data');
        console.error(err);
      } finally {
        if (showLoading) setLoading(false);
        else setRefreshing(false);
      }
    },
    [id, qrToken],
  );

  // === LOAD STORAGE ON MOUNT ===
  useEffect(() => {
    const saved = loadParticipantFromStorage();
    if (saved?.peserta_id) setJoinedParticipant(saved);
    setIsCheckingStorage(false);
  }, [loadParticipantFromStorage]);

  // === FETCH ROOM AFTER STORAGE CHECK ===
  useEffect(() => {
    if (!isCheckingStorage) fetchRoom();
  }, [isCheckingStorage, fetchRoom]);

  // === SUPABASE REALTIME & POLLING ===
  useEffect(() => {
    if (!id || loading || isCheckingStorage) return;
    const quizIdInt = parseInt(id as string);
    if (isNaN(quizIdInt)) return;

    console.log('🔌 Setting up waiting room realtime for quiz:', quizIdInt);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`waiting-room-${quizIdInt}`);

    // Listen for quiz status changes
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'kuis',
      },
      (payload) => {
        if (payload.new?.kuis_id !== quizIdInt) return;
        if (payload.new?.status === 'ongoing' && !isTeacher && !hasRedirectedRef.current) {
          console.log('🚀 Realtime: Quiz started! Redirecting...');
          redirectToTakeQuiz();
        }
        fetchRoom(false);
      },
    );

    // Listen for new participants
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peserta_kuis', filter: `kuis_id=eq.${quizIdInt}` }, () => fetchRoom(false));

    channel.subscribe((status) => {
      console.log(`📡 Waiting room realtime status:`, status);
      setIsRealtimeConnected(status === 'SUBSCRIBED');
    });

    channelRef.current = channel;

    // POLLING FALLBACK
    const interval = setInterval(async () => {
      try {
        const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
        if (qrToken) url.searchParams.set('token', qrToken);
        const res = await fetch(url.toString());
        const data = await res.json();
        
        if (data.quiz?.status === 'ongoing' && !isTeacher && !hasRedirectedRef.current) {
          console.log('🚀 Polling fallback: quiz started, redirecting...');
          redirectToTakeQuiz();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // cek setiap 3 detik

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id, loading, isCheckingStorage, isTeacher, redirectToTakeQuiz, fetchRoom, qrToken]);

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
      const participantToStore = {
        peserta_id: data.participant.peserta_id,
        nama_siswa: data.participant.nama_siswa,
        status: data.participant.status,
        waktu_masuk: data.participant.waktu_masuk,
        savedAt: new Date().toISOString(),
        qrToken,
      };
      setJoinedParticipant(participantToStore);
      saveParticipantToStorage(participantToStore);
      setParticipants((prev) => [...prev, data.participant]);
      await fetchRoom(false);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
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
    </div>
  );

  const renderStudentWaitingView = () => (
    <div className="min-h-screen bg-gray-50">
      <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />
      <main className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">GENERATE QUIZ {'>'} WAITING ROOM</p>
                  <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
                </div>
                <button onClick={() => fetchRoom(false)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {isRealtimeConnected && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <FileText className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">QUESTIONS</p>
                <p className="text-2xl font-bold text-gray-800">{quiz?.total_soal || 0}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Clock className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">TIME LIMIT</p>
                <p className="text-2xl font-bold text-gray-800">{quiz?.durasi_menit || 0}m</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Award className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">DIFFICULTY</p>
                <p className={`text-2xl font-bold capitalize ${getDifficultyColor(quiz?.tingkat_kesulitan)}`}>{quiz?.tingkat_kesulitan || 'Medium'}</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-500" />
                  {participants.length} Siswa Bergabung
                </h2>
              </div>
              {participants.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {participants.map((p) => (
                    <div key={p.peserta_id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{p.nama_siswa}</p>
                        <span className="text-xs text-emerald-500">✓ Siap</span>
                      </div>
                      <MoreVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Belum ada siswa yang bergabung</p>
                  <p className="text-xs mt-1">Bagikan QR code untuk mengundang siswa</p>
                </div>
              )}
            </div>

            <div className="bg-cyan-50 rounded-xl p-6 text-center border border-cyan-100">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-cyan-800 font-medium">
                Anda telah bergabung sebagai <strong>{joinedParticipant?.nama_siswa}</strong>
              </p>
              <p className="text-cyan-600 text-sm mt-2">Silakan tunggu guru memulai kuis...</p>
              <p className="text-cyan-500 text-xs mt-1">Halaman akan otomatis berpindah saat kuis dimulai</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  const renderTeacherView = () => (
    <div className="min-h-screen bg-gray-50">
      <Navbar fullWidth showBackButton backButtonText="Back to Dashboard" />
      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">GENERATE QUIZ {'>'} WAITING ROOM</p>
                <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
                {isRealtimeConnected && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500 mt-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-4">
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
                <button onClick={handleStartQuiz} disabled={starting || quiz?.status === 'ongoing'} className="px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 shadow-sm">
                  {quiz?.status === 'ongoing' ? 'Kuis Berlangsung' : starting ? 'Memulai...' : 'Mulai Kuis Sekarang!'}
                </button>
              </div>
            </div>
            {startError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{startError}</div>}
            <div className="grid lg:grid-cols-[320px_1fr] gap-8">
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6">
                <div className="text-center">
                  {qrUrl ? (
                    <div className="relative mx-auto w-full max-w-[220px]">
                      <img crossOrigin="anonymous" src={`${QR_SERVICE}?size=280x280&data=${encodeURIComponent(qrUrl)}`} alt="QR Code Smartify" className="mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm" />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-white p-1.5 shadow-sm">
                          <Image src="/images/logo2.png" alt="Smartify" width={40} height={40} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-sm text-gray-400 bg-gray-100 rounded-2xl">QR Code belum tersedia</div>
                  )}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-gray-800">Scan to Join</h3>
                    <p className="text-sm text-gray-500 mt-1">Buka kamera ponsel untuk bergabung</p>
                    <button onClick={openQrFull} className="mt-4 w-full px-4 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
                      Tampilkan QR Code
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-500" />
                    {participants.length} Siswa Bergabung
                  </h2>
                  <button onClick={() => fetchRoom(false)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {participants.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {participants.map((p) => (
                      <div key={p.peserta_id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{p.nama_siswa}</p>
                          <span className="text-xs text-emerald-500">✓ Siap</span>
                        </div>
                        <MoreVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Belum ada siswa yang bergabung</p>
                    <p className="text-sm text-gray-400 mt-1">Bagikan QR code untuk mengundang siswa</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (isCheckingStorage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        <p className="ml-3 text-gray-500">Memeriksa sesi...</p>
      </div>
    );
  }

  if (loading && !isCheckingStorage) {
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

  if (!isCheckingStorage) {
    if (!isTeacher && !joinedParticipant && qrToken) return renderJoinCard();
    if (!isTeacher && joinedParticipant) return renderStudentWaitingView();
  }

  return renderTeacherView();
}
