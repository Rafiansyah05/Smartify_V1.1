'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';

interface QuestionResult {
  soal_id: number;
  teks_soal: string;
  tipe_soal: 'pilihan_ganda' | 'uraian';
  urutan: number;
  poin_maksimal: number;
  pilihan: Array<{
    pilihan_id: number;
    teks_pilihan: string;
    is_benar: boolean;
    urutan: number;
  }>;
  jawaban_benar: string;
  penjelasan: string | null;
  jawaban_siswa: string | null;
  is_benar: boolean;
  poin_dapat: number;
}

export default function QuizReviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');
  const pesertaId = searchParams.get('pesertaId');

  const [quiz, setQuiz] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'all' | 'incorrect'>('all');

  const filteredQuestions = viewMode === 'incorrect' 
    ? questionResults.filter(q => !q.is_benar) 
    : questionResults;

  const currentQuestion = filteredQuestions[currentIndex];

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);

        if (!pesertaId) {
          // Try to get from localStorage
          const stored = localStorage.getItem(`quiz-result-${id}-${qrToken}`);
          if (stored) {
            const data = JSON.parse(stored);
            if (data.pesertaId) {
              router.replace(`/quiz/${id}/review?token=${qrToken}&pesertaId=${data.pesertaId}`);
              return;
            }
          }
          setError('Data peserta tidak ditemukan');
          return;
        }

        const res = await fetch(`/api/quiz/${id}/result/${pesertaId}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Gagal memuat data');
          return;
        }

        setQuiz(data.quiz);
        setParticipant(data.participant);
        setQuestionResults(data.questionResults || []);
        setStatistics(data.statistics);
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan saat memuat data');
      } finally {
        setLoading(false);
      }
    };

    fetchReview();
  }, [id, qrToken, pesertaId, router]);

  const formatText = (text?: string | null) => {
    if (!text) return null;
    const lines = text.split(/<br\s*\/?>|\n/g);

    return (
      <>
        {lines.map((line, i) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <span key={i}>
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={j} className="font-bold">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={j}>{part}</span>;
              })}
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
      </>
    );
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleQuestionJump = (index: number) => {
    setCurrentIndex(index);
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.push(`/quiz/${id}/result?token=${qrToken}&pesertaId=${pesertaId}`)} 
              className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Kembali ke Hasil</span>
            </button>

            <div className="flex items-center gap-4">
              {statistics && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">{statistics.correctCount} Benar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600 font-medium">{statistics.incorrectCount} Salah</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Quiz Info Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">EVALUASI KUIS</p>
              <h1 className="text-xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {participant?.nama_siswa} - Nilai: <span className="font-bold text-cyan-500">{participant?.nilai || 0}</span>
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
              <button
                onClick={() => { setViewMode('all'); setCurrentIndex(0); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  viewMode === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Semua Soal ({questionResults.length})
              </button>
              <button
                onClick={() => { setViewMode('incorrect'); setCurrentIndex(0); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  viewMode === 'incorrect' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Hanya Salah ({questionResults.filter(q => !q.is_benar).length})
              </button>
            </div>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Semua Jawaban Benar!</h2>
            <p className="text-gray-500">Selamat, Anda tidak memiliki jawaban yang salah.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-8">
            {/* Main Content - Question Review */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {currentQuestion && (
                <>
                  {/* Question Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-gray-800">
                        Soal {viewMode === 'all' ? currentQuestion.urutan : currentIndex + 1}
                      </h2>
                      <span className="text-xs text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full">
                        {currentQuestion.tipe_soal === 'pilihan_ganda' ? 'Pilihan Ganda' : 'Uraian'}
                      </span>
                    </div>
                    {currentQuestion.is_benar ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Benar</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Salah</span>
                      </div>
                    )}
                  </div>

                  {/* Question Text */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                    <div className="text-gray-700 leading-relaxed">{formatText(currentQuestion.teks_soal)}</div>
                  </div>

                  {/* Answer Options (Multiple Choice) */}
                  {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.pilihan && (
                    <div className="space-y-3 mb-6">
                      {currentQuestion.pilihan.sort((a, b) => a.urutan - b.urutan).map((option, index) => {
                        const label = String.fromCharCode(65 + index);
                        const isCorrect = option.is_benar;
                        const isSelected = currentQuestion.jawaban_siswa === option.teks_pilihan;

                        let bgClass = 'border-gray-100 bg-white';
                        let textClass = 'text-gray-700';
                        let labelClass = 'bg-gray-200 text-gray-700';

                        if (isCorrect) {
                          bgClass = 'border-emerald-300 bg-emerald-50';
                          labelClass = 'bg-emerald-500 text-white';
                          textClass = 'text-emerald-700';
                        } else if (isSelected && !isCorrect) {
                          bgClass = 'border-red-300 bg-red-50';
                          labelClass = 'bg-red-500 text-white';
                          textClass = 'text-red-700';
                        }

                        return (
                          <div
                            key={option.pilihan_id}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 ${bgClass}`}
                          >
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${labelClass}`}>
                              {label}
                            </div>
                            <span className={`font-medium flex-1 ${textClass}`}>{option.teks_pilihan}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            )}
                            {isSelected && !isCorrect && (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay Answer Review */}
                  {currentQuestion.tipe_soal === 'uraian' && (
                    <div className="space-y-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Jawaban Anda:</p>
                        <p className="text-gray-700">{currentQuestion.jawaban_siswa || 'Tidak dijawab'}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2">Kunci Jawaban:</p>
                        <p className="text-emerald-700">{currentQuestion.jawaban_benar || 'Tidak ada kunci jawaban'}</p>
                      </div>
                    </div>
                  )}

                  {/* Points Earned */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
                    <span className="text-sm text-gray-600">Poin yang didapat:</span>
                    <span className="font-bold text-gray-800">
                      {currentQuestion.poin_dapat.toFixed(1)} / {currentQuestion.poin_maksimal}
                    </span>
                  </div>

                  {/* Explanation */}
                  {currentQuestion.penjelasan && (
                    <div className="p-5 bg-cyan-50 rounded-xl border border-cyan-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-cyan-800 mb-2">Penjelasan:</p>
                          <div className="text-sm text-cyan-700 leading-relaxed">
                            {formatText(currentQuestion.penjelasan)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-100">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Sebelumnya
                    </button>
                    <span className="text-sm text-gray-500">
                      {currentIndex + 1} dari {filteredQuestions.length}
                    </span>
                    <button
                      onClick={handleNext}
                      disabled={currentIndex === filteredQuestions.length - 1}
                      className="flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Sidebar - Question Navigator */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Navigasi Soal</h3>
              
              <div className="grid grid-cols-6 gap-2 mb-6">
                {filteredQuestions.map((q, index) => {
                  const isCurrent = index === currentIndex;

                  return (
                    <button
                      key={q.soal_id}
                      onClick={() => handleQuestionJump(index)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        isCurrent 
                          ? 'bg-cyan-400 text-white' 
                          : q.is_benar 
                            ? 'bg-emerald-100 text-emerald-600' 
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {viewMode === 'all' ? q.urutan : index + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 mb-3">Keterangan:</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-cyan-400"></div>
                    <span className="text-gray-600">Soal saat ini</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-100"></div>
                    <span className="text-gray-600">Jawaban benar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-100"></div>
                    <span className="text-gray-600">Jawaban salah</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {statistics && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 mb-3">Ringkasan:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Soal</span>
                      <span className="font-medium text-gray-800">{statistics.totalQuestions}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Benar</span>
                      <span className="font-medium text-emerald-600">{statistics.correctCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Salah</span>
                      <span className="font-medium text-red-600">{statistics.incorrectCount}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm">
                      <span className="text-gray-800 font-medium">Nilai Akhir</span>
                      <span className="font-bold text-cyan-500">{statistics.score}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
