'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowRight, Share2, Clock, Award } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  peserta_id: string;
  nama_siswa: string;
  nilai: number;
  isCurrentUser?: boolean;
}

export default function QuizResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');
  const pesertaId = searchParams.get('pesertaId');

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);

        // Get pesertaId from URL or localStorage
        let participantId = pesertaId;
        if (!participantId) {
          const stored = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
          if (stored) {
            const data = JSON.parse(stored);
            participantId = data.pesertaId;
            // Redirect with pesertaId in URL
            if (participantId) {
              router.replace(`/quiz/${id}/result?token=${qrToken}&pesertaId=${participantId}`);
              return;
            }
          }
        }

        if (!participantId) {
          setError('Data hasil tidak ditemukan');
          return;
        }

        // Fetch from server
        const res = await fetch(`/api/quiz/${id}/result/${participantId}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Gagal memuat hasil');
          return;
        }

        setQuiz(data.quiz);
        setParticipant(data.participant);
        setStatistics(data.statistics);
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.userRank || 0);
        setTotalParticipants(data.totalParticipants || 0);
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan saat memuat hasil');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id, qrToken, pesertaId, router]);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-400 text-gray-800';
      case 2:
        return 'bg-gray-300 text-gray-800';
      case 3:
        return 'bg-amber-500 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRankBgColor = (rank: number, isCurrentUser?: boolean) => {
    if (isCurrentUser) return 'bg-cyan-400 text-white';
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-100';
    }
  };

  const handleViewAnswers = () => {
    router.push(`/quiz/${id}/review?token=${qrToken}&pesertaId=${participant?.peserta_id || pesertaId}`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Hasil Kuis: ${quiz?.judul}`,
        text: `Saya mendapat nilai ${statistics?.score || 0} pada ${quiz?.judul}!`,
        url: window.location.href,
      });
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
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

  const userScore = statistics?.score || 0;
  const correctCount = statistics?.correctCount || 0;
  const incorrectCount = statistics?.incorrectCount || 0;
  const totalQuestions = statistics?.totalQuestions || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div>
            <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider mb-1">SELESAI!!!</p>
            <h1 className="text-xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 mt-8">
        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          {/* Score Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xs uppercase tracking-wider text-gray-400 text-center mb-6">YOUR FINAL SCORE</h2>

            {/* Circular Score */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                {/* Progress circle */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#22D3EE" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(userScore / 100) * 283} 283`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-cyan-400">{userScore}</span>
                <span className="text-gray-400 text-sm">out of 100</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">{correctCount} Benar</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-500 font-medium">{incorrectCount} Salah</span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Waktu Pengerjaan</span>
                </div>
                <span className="font-medium text-gray-800">{formatDuration(participant?.durasi_pengerjaan)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Award className="w-4 h-4" />
                  <span>Status</span>
                </div>
                <span className={`font-medium ${participant?.status_remedial ? 'text-red-500' : 'text-emerald-500'}`}>
                  {participant?.status_remedial ? 'Remedial' : 'Lulus'}
                </span>
              </div>
            </div>

            {/* Share Button */}
            <button onClick={handleShare} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
              <Share2 className="w-5 h-5" />
              Bagikan
            </button>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Leaderboard ({totalParticipants} siswa)</h2>

            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <div 
                    key={entry.peserta_id} 
                    className={`flex items-center justify-between p-4 rounded-xl border ${entry.isCurrentUser ? 'bg-cyan-400 border-cyan-400' : getRankBgColor(entry.rank)}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${entry.isCurrentUser ? 'bg-cyan-500 text-white' : getRankColor(entry.rank)}`}>
                        {entry.rank}
                      </span>

                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                        <span className="text-white text-xs font-medium">{entry.nama_siswa.substring(0, 2).toUpperCase()}</span>
                      </div>

                      <span className={`font-medium ${entry.isCurrentUser ? 'text-white' : 'text-gray-800'}`}>
                        {entry.isCurrentUser ? `You (${entry.nama_siswa})` : entry.nama_siswa}
                      </span>
                    </div>

                    <span className={`font-bold text-lg ${entry.isCurrentUser ? 'text-white' : 'text-gray-800'}`}>{entry.nilai}</span>
                  </div>
                ))}

                {/* Current user if not in top 10 */}
                {userRank > 10 && (
                  <>
                    <div className="flex items-center justify-center py-2">
                      <span className="text-gray-400">...</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-400">
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-cyan-500 text-white">{userRank}</span>
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                          <span className="text-white text-xs font-medium">{participant?.nama_siswa?.substring(0, 2).toUpperCase() || 'AN'}</span>
                        </div>
                        <span className="font-medium text-white">You ({participant?.nama_siswa || 'Anda'})</span>
                      </div>
                      <span className="font-bold text-lg text-white">{userScore}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Belum ada data leaderboard
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleViewAnswers}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full shadow-lg shadow-cyan-400/30 transition-all hover:shadow-xl hover:shadow-cyan-400/40"
        >
          Lihat Jawaban
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
