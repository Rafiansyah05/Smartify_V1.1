'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowRight, Clock, Award, BookOpen, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';

interface WeakArea {
  materi: string;
  rekomendasi: string;
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
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);

        let participantId = pesertaId;
        if (!participantId) {
          const stored = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
          if (stored) {
            const data = JSON.parse(stored);
            participantId = data.pesertaId;
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

        // Fetch AI recommendations for weak areas
        if (data.weakAnswers && data.weakAnswers.length > 0) {
          setLoadingAI(true);
          await fetchAIRecommendations(data.weakAnswers, data.quiz?.judul);
        }
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan saat memuat hasil');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id, qrToken, pesertaId, router]);

  const fetchAIRecommendations = async (weakAnswers: any[], quizTitle: string) => {
    try {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weakAnswers, quizTitle }),
      });
      const data = await res.json();
      if (res.ok && data.recommendations) {
        setWeakAreas(data.recommendations);
      }
    } catch (err) {
      console.error('AI recommendation error:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleViewAnswers = () => {
    router.push(`/quiz/${id}/review?token=${qrToken}&pesertaId=${participant?.peserta_id || pesertaId}`);
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
  const isPassed = userScore >= (quiz?.kkm || 75);

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

      <div className="max-w-4xl mx-auto px-6 mt-8">
        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">YOUR FINAL SCORE</h2>

            {/* Big Score Display */}
            <div className="inline-flex flex-col items-center">
              <div className="text-7xl font-bold text-cyan-400">{userScore}</div>
              <span className="text-gray-400 text-sm">out of 100</span>
            </div>

            {/* Pass/Fail Status */}
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isPassed ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
              <span className="font-medium text-sm">{isPassed ? 'LULUS' : 'TIDAK LULUS'}</span>
              {!isPassed && <span className="text-xs ml-1">(KKM: {quiz?.kkm || 75})</span>}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-emerald-600 font-medium">Benar</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600">{correctCount}</span>
              <span className="text-xs text-emerald-500 ml-1">soal</span>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-600 font-medium">Salah</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{incorrectCount}</span>
              <span className="text-xs text-red-500 ml-1">soal</span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
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
                <span>Total Soal</span>
              </div>
              <span className="font-medium text-gray-800">{totalQuestions} soal</span>
            </div>
          </div>
        </div>

        {/* AI Recommendations Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Rekomendasi Belajar</h2>
          </div>

          {loadingAI ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <span className="ml-3 text-gray-500">AI sedang menganalisis hasil Anda...</span>
            </div>
          ) : weakAreas.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">Berdasarkan jawaban Anda, berikut materi yang perlu dipelajari lebih lanjut:</p>
              {weakAreas.map((area, index) => (
                <div key={index} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">📚 {area.materi}</h3>
                  <p className="text-sm text-amber-700 leading-relaxed">{area.rekomendasi}</p>
                </div>
              ))}
            </div>
          ) : incorrectCount > 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Sedang menganalisis materi yang perlu dipelajari...</p>
              <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-600">
                <RefreshCw className="w-4 h-4" />
                Coba lagi
              </button>
            </div>
          ) : (
            <div className="text-center py-8 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-semibold text-emerald-700 mb-1">Selamat! Anda menjawab semua soal dengan benar!</h3>
              <p className="text-sm text-emerald-600">Pemahaman Anda sudah sangat baik. Pertahankan prestasi ini!</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleViewAnswers}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full shadow-lg shadow-cyan-400/30 transition-all hover:shadow-xl hover:shadow-cyan-400/40"
        >
          Lihat Jawaban & Pembahasan
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
