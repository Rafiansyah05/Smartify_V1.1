'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowRight, Share2 } from 'lucide-react';
import Image from 'next/image';

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isCurrentUser?: boolean;
  avatar?: string;
}

export default function QuizResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [userRank, setUserRank] = useState(0);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);

        // Get stored result data
        const storedResult = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
        if (storedResult) {
          setResult(JSON.parse(storedResult));
        }

        // Fetch quiz data
        const quizRes = await fetch(`/api/quiz/${id}`, { credentials: 'include' });
        const quizData = await quizRes.json();

        if (quizRes.ok) {
          setQuiz(quizData.kuis);

          // Calculate score (mock implementation - in real app this would be server-side)
          const questions = quizData.soal || [];
          const answers = storedResult ? JSON.parse(storedResult).answers : {};

          let correct = 0;
          let incorrect = 0;

          questions.forEach((q: any) => {
            const userAnswer = answers[q.soal_id];
            if (userAnswer) {
              if (q.tipe_soal === 'pilihan_ganda') {
                const correctOption = q.pilihan?.find((p: any) => p.is_benar);
                if (correctOption && userAnswer === correctOption.teks_pilihan) {
                  correct++;
                } else {
                  incorrect++;
                }
              } else {
                // For essay, consider it correct if answered (simplified)
                correct++;
              }
            }
          });

          setCorrectCount(correct);
          setIncorrectCount(incorrect);

          const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
          setUserScore(score);

          // Generate mock leaderboard
          const participantName = storedResult ? JSON.parse(storedResult).participantName : 'Anda';

          const mockLeaderboard: LeaderboardEntry[] = [
            { rank: 1, name: 'Bahalililili', score: 98 },
            { rank: 2, name: 'Parabwowo', score: 95 },
            { rank: 3, name: 'Abu Kamil', score: 94 },
            { rank: 4, name: 'Gibrann', score: 92 },
            { rank: 5, name: 'Giberan21', score: 90 },
          ];

          // Find user's position
          let userPosition = mockLeaderboard.findIndex((entry) => entry.score < score);
          if (userPosition === -1) userPosition = mockLeaderboard.length;

          // If user is in top 5, insert them
          if (userPosition < 5) {
            mockLeaderboard.splice(userPosition, 0, {
              rank: userPosition + 1,
              name: participantName,
              score: score,
              isCurrentUser: true,
            });
            // Re-rank everyone
            mockLeaderboard.forEach((entry, idx) => {
              entry.rank = idx + 1;
            });
            // Keep only top 5 + user if not in top 5
            mockLeaderboard.splice(6);
          }

          setLeaderboard(mockLeaderboard.slice(0, 5));
          setUserRank(score >= 90 ? userPosition + 1 : 7); // Mock rank
          setTotalParticipants(34); // Mock total
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id, qrToken]);

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
        return 'bg-yellow-400';
      case 2:
        return 'bg-gray-200';
      case 3:
        return 'bg-amber-400';
      default:
        return 'bg-gray-50';
    }
  };

  const handleViewAnswers = () => {
    router.push(`/quiz/${id}/review?token=${qrToken}`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Hasil Kuis: ${quiz?.judul}`,
        text: `Saya mendapat nilai ${userScore} pada ${quiz?.judul}!`,
        url: window.location.href,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

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
                <span className="text-emerald-500 font-medium">{correctCount} Correct</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-500 font-medium">{incorrectCount} Incorrect</span>
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

            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className={`flex items-center justify-between p-4 rounded-xl ${getRankBgColor(entry.rank, entry.isCurrentUser)}`}>
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${entry.isCurrentUser ? 'bg-cyan-500 text-white' : 'bg-white/50 text-gray-700'}`}>{entry.rank}</span>

                    {entry.isCurrentUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                        <span className="text-white text-xs font-medium">{entry.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}

                    <span className={`font-medium ${entry.isCurrentUser ? 'text-white' : 'text-gray-800'}`}>{entry.isCurrentUser ? `You (${entry.name})` : entry.name}</span>
                  </div>

                  <span className={`font-bold text-lg ${entry.isCurrentUser ? 'text-white' : 'text-gray-800'}`}>{entry.score}</span>
                </div>
              ))}

              {/* Current user if not in top 5 */}
              {userRank > 5 && (
                <>
                  <div className="flex items-center justify-center py-2">
                    <span className="text-gray-400">...</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-400">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-cyan-500 text-white">{userRank}</span>
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                        <span className="text-white text-xs font-medium">{result?.participantName?.substring(0, 2).toUpperCase() || 'AN'}</span>
                      </div>
                      <span className="font-medium text-white">You ({result?.participantName || 'Anda'})</span>
                    </div>
                    <span className="font-bold text-lg text-white">{userScore}</span>
                  </div>
                </>
              )}
            </div>
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
