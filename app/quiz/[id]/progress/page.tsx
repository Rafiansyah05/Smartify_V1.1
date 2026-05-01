'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Clock, CheckCircle2, Award, TrendingUp, Users, FileText } from 'lucide-react';

interface Participant {
  peserta_id: string;
  nama_siswa: string;
  status: 'selesai' | 'sedang_mengerjakan';
  nilai: number | null;
  answered_count: number;
  total_questions: number;
  progress_percent: number;
  durasi_pengerjaan: number | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
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

export default function ProgressPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [quiz, setQuiz] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchProgress = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const res = await fetch(`/api/quiz/${id}/progress`, { credentials: 'include' });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Gagal memuat progress');
          return;
        }

        setQuiz(data.quiz);
        setParticipants(data.participants || []);
        setStatistics(data.statistics);
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
    },
    [id],
  );

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'selesai') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          Selesai
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
        <Clock className="w-3 h-3" />
        Mengerjakan
      </span>
    );
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
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
            <span className="font-semibold text-lg">Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <button onClick={() => fetchProgress(false)} disabled={refreshing} className="p-2.5 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-5 h-5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Quiz Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Progress Kuis'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total {quiz?.total_questions || 0} soal | Durasi {quiz?.durasi_menit || 0} menit | KKM {quiz?.kkm || 70}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{statistics?.totalParticipants || 0}</p>
            <p className="text-xs text-gray-400">Peserta</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">Selesai</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{statistics?.completedCount || 0}</p>
            <p className="text-xs text-gray-400">Peserta</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Mengerjakan</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{statistics?.inProgressCount || 0}</p>
            <p className="text-xs text-gray-400">Peserta</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-cyan-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Rata-rata</span>
            </div>
            <p className="text-2xl font-bold text-cyan-600">{statistics?.avgScore || 0}</p>
            <p className="text-xs text-gray-400">Nilai</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <Award className="w-4 h-4" />
              <span className="text-xs">Tertinggi</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{statistics?.highestScore || 0}</p>
            <p className="text-xs text-gray-400">Nilai</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs">Lulus</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{statistics?.passedCount || 0}</p>
            <p className="text-xs text-gray-400">Peserta</p>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Siswa</th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                  <th className="text-center py-4 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Durasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {participants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      Belum ada siswa yang bergabung
                    </td>
                  </tr>
                ) : (
                  participants.map((participant, index) => (
                    <tr key={participant.peserta_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            index === 0 ? 'bg-yellow-400 text-gray-800' : index === 1 ? 'bg-gray-300 text-gray-800' : index === 2 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-gray-800">{participant.nama_siswa}</span>
                      </td>
                      <td className="py-4 px-6 text-center">{getStatusBadge(participant.status)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-cyan-400 rounded-full h-2 transition-all duration-300" style={{ width: `${participant.progress_percent}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 min-w-[45px]">
                            {participant.answered_count}/{participant.total_questions}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`font-bold text-lg ${getScoreColor(participant.nilai)}`}>{participant.nilai !== null ? participant.nilai : '-'}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm text-gray-600 font-mono">{formatDuration(participant.durasi_pengerjaan)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
