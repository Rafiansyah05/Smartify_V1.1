'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

interface Question {
  soal_id: number;
  teks_soal: string;
  tipe_soal: 'pilihan_ganda' | 'uraian';
  pilihan?: Array<{
    pilihan_id: number;
    teks_pilihan: string;
  }>;
}

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  const qrToken = searchParams.get('token');

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [participant, setParticipant] = useState<any>(null);

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const totalQuestions = shuffledQuestions.length;
  const answeredCount = Object.keys(answers).length;

  // Shuffle array utility
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      
      // Get participant info from localStorage
      const storageKey = `waiting-room-${id}-${qrToken}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setParticipant(JSON.parse(stored));
      }

      const res = await fetch(`/api/quiz/${id}`, { credentials: 'include' });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Gagal memuat kuis');
        return;
      }

      setQuiz(data.kuis);
      setQuestions(data.soal || []);
      
      // Shuffle questions for each student (randomize order)
      const shuffled = shuffleArray(data.soal || []);
      // Also shuffle choices for each multiple choice question
      const shuffledWithChoices = shuffled.map(q => ({
        ...q,
        pilihan: q.tipe_soal === 'pilihan_ganda' && q.pilihan 
          ? shuffleArray(q.pilihan) 
          : q.pilihan
      }));
      setShuffledQuestions(shuffledWithChoices);
      
      // Set timer
      if (data.kuis?.durasi_menit) {
        setTimeRemaining(data.kuis.durasi_menit * 60);
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat memuat kuis');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto submit when time is up
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    if (!id || !qrToken) {
      setError('Token tidak valid');
      return;
    }
    fetchQuiz();
  }, [id, qrToken]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatText = (text?: string) => {
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

  const handleAnswerSelect = (answer: string) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.soal_id]: answer
    }));
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleQuestionJump = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Calculate score (in real implementation, this would be done server-side)
      // For now, we'll navigate to results page with the answers
      const participantData = participant || { nama_siswa: 'Siswa' };
      
      // Store answers and navigate to results
      const resultData = {
        answers,
        participantName: participantData.nama_siswa,
        quizId: id,
        token: qrToken,
        totalQuestions,
        answeredCount
      };
      
      localStorage.setItem(`quiz-result-${id}-${qrToken}`, JSON.stringify(resultData));
      router.push(`/quiz/${id}/result?token=${qrToken}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
      setShowConfirmSubmit(false);
    }
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
          <button 
            onClick={() => router.push('/dashboard')} 
            className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">SEMANGAT!!</p>
              <h1 className="text-xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
            </div>
            
            {/* Timer */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-white rounded-full">
              <Clock className="w-5 h-5" />
              <span className="font-bold">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* Main Content - Question Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {currentQuestion ? (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">
                    Soal {currentQuestionIndex + 1}.
                  </h2>
                  <div className="text-gray-700 leading-relaxed">
                    {formatText(currentQuestion.teks_soal)}
                  </div>
                </div>

                {/* Answer Options */}
                {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.pilihan && (
                  <div className="space-y-4 mb-8">
                    {currentQuestion.pilihan.map((option, index) => {
                      const label = String.fromCharCode(65 + index);
                      const isSelected = answers[currentQuestion.soal_id] === option.teks_pilihan;
                      
                      return (
                        <button
                          key={option.pilihan_id}
                          onClick={() => handleAnswerSelect(option.teks_pilihan)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected 
                              ? 'border-cyan-400 bg-cyan-50' 
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                            isSelected 
                              ? 'bg-cyan-400 text-white' 
                              : 'bg-cyan-400 text-white'
                          }`}>
                            {label}
                          </div>
                          <span className="text-gray-700 font-medium">{option.teks_pilihan}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Essay Answer */}
                {currentQuestion.tipe_soal === 'uraian' && (
                  <div className="mb-8">
                    <textarea
                      value={answers[currentQuestion.soal_id] || ''}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      rows={6}
                      placeholder="Tulis jawaban di sini..."
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="px-8 py-3 bg-red-400 hover:bg-red-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentQuestionIndex === totalQuestions - 1}
                    className="px-8 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Tidak ada soal tersedia
              </div>
            )}
          </div>

          {/* Sidebar - Question Navigator */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">NAMA LENGKAP:</p>
              <h3 className="text-lg font-bold text-gray-800">{participant?.nama_siswa || 'Siswa'}</h3>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Question</p>
              <div className="grid grid-cols-6 gap-2">
                {shuffledQuestions.map((q, index) => {
                  const isAnswered = answers[q.soal_id] !== undefined;
                  const isCurrent = index === currentQuestionIndex;
                  
                  return (
                    <button
                      key={q.soal_id}
                      onClick={() => handleQuestionJump(index)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        isCurrent
                          ? 'bg-cyan-400 text-white'
                          : isAnswered
                          ? 'bg-cyan-100 text-cyan-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors"
            >
              Kumpulkan
            </button>

            <div className="mt-4 text-center text-sm text-gray-500">
              {answeredCount} dari {totalQuestions} soal terjawab
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Konfirmasi Pengumpulan</h2>
            <p className="text-gray-600 text-center mb-2">
              Anda telah menjawab {answeredCount} dari {totalQuestions} soal.
            </p>
            {answeredCount < totalQuestions && (
              <p className="text-amber-600 text-sm text-center mb-6">
                Masih ada {totalQuestions - answeredCount} soal yang belum dijawab!
              </p>
            )}
            <p className="text-gray-600 text-center mb-6">
              Apakah Anda yakin ingin mengumpulkan jawaban?
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50"
              >
                {submitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
