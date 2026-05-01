'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell, Clock, RefreshCw, Filter, ChevronLeft, ChevronRight, Search, CheckCircle2, Users, TrendingUp, Award } from 'lucide-react';

interface Participant {
  peserta_id: string;
  nama_siswa: string;
  status: 'sedang_mengerjakan' | 'selesai' | string;
  nilai?: number | null;
  waktu_masuk?: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  durasi_pengerjaan?: number | null;
  answered_count?: number;
  total_questions?: number;
  progress_percent?: number;
  status_remedial?: boolean | null;
}

interface Statistics {
  totalParticipants: number;
  completedCount: number;
  inProgressCount: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  failedCount: number;
}

export default function QuizProgressPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sedang_mengerjakan' | 'selesai'>('all');

  const itemsPerPage = 8;
  const isTeacher = useMemo(() => user?.role === 'guru' || user?.role === 'admin', [user]);

  // Filter participants based on search and status
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch = p.nama_siswa.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [participants, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredParticipants.slice(start, start + itemsPerPage);
  }, [filteredParticipants, currentPage]);

  const fetchProgress = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      // Fetch from progress API
      const res = await fetch(`/api/quiz/${id}/progress`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal memuat data');
        return;
      }

      setQuiz(data.quiz);
      setParticipants(data.participants || []);
      setStatistics(data.statistics || null);

      // Also fetch user info
      const userUrl = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
      if (qrToken) userUrl.searchParams.set('token', qrToken);
      const userRes = await fetch(userUrl.toString(), { credentials: 'include' });
      const userData = await userRes.json();
      if (userRes.ok) {
        setUser(userData.user);
      }

      // Set quiz start time if not already set
      if (!quizStartTime && data.quiz?.durasi_menit) {
        setQuizStartTime(new Date());
        setTimeRemaining(data.quiz.durasi_menit * 60);
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
  }, [id, qrToken, quizStartTime]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (loading) return;

    const interval = setInterval(() => {
      fetchProgress(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [loading, fetchProgress]);

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

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Mengerjakan</span>;
  };

  const getTimeColor = () => {
    if (timeRemaining <= 60) return 'bg-red-500 text-white';
    if (timeRemaining <= 300) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-800';
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

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{statistics.totalParticipants}</p>
                  <p className="text-xs text-gray-500">Total Peserta</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{statistics.completedCount}</p>
                  <p className="text-xs text-gray-500">Selesai</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{statistics.avgScore}</p>
                  <p className="text-xs text-gray-500">Rata-rata Nilai</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{statistics.passedCount}</p>
                  <p className="text-xs text-gray-500">Lulus KKM</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                <span className="text-amber-600 font-medium">
                  {statistics?.inProgressCount || 0} sedang mengerjakan
                </span>
              </div>

              {/* Timer */}
              <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full ${getTimeColor()}`}>
                <Clock className="w-5 h-5" />
                <span className="font-bold">{formatTime(timeRemaining)}</span>
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
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="all">Semua Status</option>
                <option value="sedang_mengerjakan">Sedang Mengerjakan</option>
                <option value="selesai">Selesai</option>
              </select>

              <button 
                onClick={() => fetchProgress(false)} 
                disabled={refreshing || loading} 
                className="p-3 bg-cyan-400 hover:bg-cyan-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
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
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Nilai</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Durasi</th>
                  <th className="px-4 py-4 text-left text-xs font-semibold text-cyan-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedParticipants.length > 0 ? (
                  paginatedParticipants.map((participant, index) => (
                    <tr key={participant.peserta_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-gray-500">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-800">{participant.nama_siswa}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyan-400 rounded-full transition-all"
                              style={{ width: `${participant.progress_percent || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {participant.answered_count || 0}/{participant.total_questions || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {participant.nilai !== null && participant.nilai !== undefined ? (
                          <span className={`text-sm font-bold ${participant.status_remedial ? 'text-red-500' : 'text-emerald-500'}`}>
                            {participant.nilai}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {formatDuration(participant.durasi_pengerjaan)}
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(participant.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      {searchQuery || statusFilter !== 'all' ? 'Tidak ada siswa yang ditemukan' : 'Belum ada siswa yang mengerjakan kuis'}
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
