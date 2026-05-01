'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell, Clock, RefreshCw, Filter, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface Participant {
  peserta_id: string;
  nama_siswa: string;
  status: 'sedang_mengerjakan' | 'selesai' | string;
  nilai?: number;
  waktu_mulai?: string;
  waktu_selesai?: string;
}

export default function QuizProgressPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);

  const itemsPerPage = 8;
  const isTeacher = useMemo(() => user?.role === 'guru' || user?.role === 'admin', [user]);

  // Filter participants based on search
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => p.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [participants, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredParticipants.slice(start, start + itemsPerPage);
  }, [filteredParticipants, currentPage]);

  const fetchProgress = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      // Fetch quiz data
      const quizRes = await fetch(`/api/quiz/${id}`, { credentials: 'include' });
      const quizData = await quizRes.json();

      if (!quizRes.ok) {
        setError(quizData.error || 'Gagal memuat kuis');
        return;
      }

      setQuiz(quizData.kuis);

      // Fetch waiting room for participants
      const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
      if (qrToken) url.searchParams.set('token', qrToken);
      const roomRes = await fetch(url.toString(), { credentials: 'include' });
      const roomData = await roomRes.json();

      if (roomRes.ok) {
        setUser(roomData.user);
        // Mock progress data - in real implementation this would come from API
        const participantsWithProgress = (roomData.participants || []).map((p: any, index: number) => ({
          ...p,
          status: Math.random() > 0.3 ? 'sedang_mengerjakan' : 'selesai',
          nilai: Math.floor(Math.random() * 100),
        }));
        setParticipants(participantsWithProgress);

        // Set quiz start time if not already set
        if (!quizStartTime && quizData.kuis?.durasi_menit) {
          setQuizStartTime(new Date());
          setTimeRemaining(quizData.kuis.durasi_menit * 60);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat memuat data');
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    fetchProgress();
  }, [id]);

  // Redirect students to take page
  useEffect(() => {
    if (!loading && !isTeacher && qrToken) {
      router.push(`/quiz/${id}/take?token=${qrToken}`);
    }
  }, [loading, isTeacher, qrToken, id, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const getStatusBadge = (status: string) => {
    if (status === 'selesai') {
      return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Selesai</span>;
    }
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Proses</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-lg">Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
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
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                GENERATE QUIZ {'>'} PREVIEW {'>'} PROGRESS QUIZ
              </p>
              <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Status Badge */}
              <div className="px-5 py-2.5 bg-amber-50 border border-amber-200 rounded-full">
                <span className="text-amber-600 font-medium">Dalam pengerjaan</span>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 rounded-full">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="font-bold text-gray-800">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => fetchProgress(false)} disabled={refreshing || loading} className="p-3 bg-cyan-400 hover:bg-cyan-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">NO</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Nama Lengkap</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Nilai Saat Ini</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedParticipants.length > 0 ? (
                  paginatedParticipants.map((participant, index) => (
                    <tr key={participant.peserta_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-gray-500">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-800">{participant.nama_siswa}</td>
                      <td className="px-4 py-4 text-sm font-bold text-gray-800">{participant.nilai ?? '-'}</td>
                      <td className="px-4 py-4">{getStatusBadge(participant.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      {searchQuery ? 'Tidak ada siswa yang ditemukan' : 'Belum ada siswa yang mengerjakan kuis'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Menampilkan {currentPage} dari {totalPages} halaman
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === currentPage ? 'bg-cyan-400 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
