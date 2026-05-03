'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Clock, AlertTriangle } from 'lucide-react';

interface Question {
  soal_id: number;
  teks_soal: string;
  tipe_soal: 'pilihan_ganda' | 'isian_singkat' | 'uraian';
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
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | ''>('');

  const hasSubmittedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const totalQuestions = shuffledQuestions.length;
  const answeredCount = Object.keys(answers).length;

  // Helper untuk mendapatkan storage key yang konsisten
  const getParticipantStorageKey = useCallback(() => {
    return `quiz-participant-${id}`;
  }, [id]);

  const getWaitingRoomStorageKey = useCallback(() => {
    return `waiting-room-${id}-${qrToken}`;
  }, [id, qrToken]);

  // Shuffle array utility
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const loadParticipantFromStorage = useCallback(() => {
    // Coba dari berbagai sumber storage
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
          if (parsed && parsed.peserta_id) {
            console.log(`✅ Loaded participant from ${source.type}[${source.key}]:`, parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.error(`Failed to parse from ${source.key}:`, e);
      }
    }
    return null;
  }, [id, getParticipantStorageKey, getWaitingRoomStorageKey]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);

      // Get participant info from storage (multiple sources)
      const participantData = loadParticipantFromStorage();

      if (participantData) {
        console.log('Loaded participant from storage:', participantData);
        setParticipant(participantData);
      } else {
        console.log('No participant found in storage');
        setError('Data peserta tidak ditemukan. Silakan scan QR code kembali.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/quiz/${id}?token=${qrToken}`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal memuat kuis');
        return;
      }

      // Check if quiz is ongoing
      if (data.kuis?.status !== 'ongoing') {
        setError('Kuis belum dimulai atau sudah berakhir');
        return;
      }

      setQuiz(data.kuis);
      setQuestions(data.soal || []);

      // Shuffle questions for each student (randomize order)
      const shuffled = shuffleArray<Question>(data.soal || []);
      const shuffledWithChoices = shuffled.map((q: Question) => ({
        ...q,
        pilihan: q.tipe_soal === 'pilihan_ganda' && q.pilihan ? shuffleArray(q.pilihan) : q.pilihan,
      }));
      setShuffledQuestions(shuffledWithChoices);

      // Set timer based on quiz duration
      if (data.kuis?.durasi_menit) {
        setTimeRemaining(data.kuis.durasi_menit * 60);
      }

      // Restore saved answers if any
      const savedAnswers = localStorage.getItem(`quiz-answers-${id}-${qrToken}`);
      if (savedAnswers) {
        try {
          const parsed = JSON.parse(savedAnswers);
          setAnswers(parsed);
        } catch (e) {
          console.error('Failed to restore answers', e);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat memuat kuis');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save answers to localStorage
  const saveAnswersLocally = useCallback(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`quiz-answers-${id}-${qrToken}`, JSON.stringify(answers));
    }
  }, [answers, id, qrToken]);

  // Debounced auto-save
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (Object.keys(answers).length > 0) {
      setSaveStatus('saving');
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveAnswersLocally();
        
        // Sync to server for real-time teacher progress
        if (participant?.peserta_id) {
          fetch(`/api/quiz/${id}/save-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pesertaId: participant.peserta_id,
              answers: answers
            })
          }).catch(console.error);
        }
        
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      }, 1000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [answers, saveAnswersLocally, participant?.peserta_id, id]);

  // Submit quiz to server
  const handleSubmit = useCallback(
    async (isAutoSubmit = false) => {
      if (hasSubmittedRef.current) return;

      // Validasi pesertaId
      if (!participant?.peserta_id) {
        console.error('No peserta_id found:', participant);
        setError('Data peserta tidak ditemukan. Silakan refresh halaman.');
        return;
      }

      console.log('Submitting with pesertaId:', participant.peserta_id);

      hasSubmittedRef.current = true;
      setSubmitting(true);
      if (isAutoSubmit) setAutoSubmitting(true);

      try {
        const res = await fetch(`/api/quiz/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pesertaId: participant.peserta_id,
            answers,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengirim jawaban');
        }

        // Clear all storage related to this quiz
        localStorage.removeItem(`quiz-answers-${id}-${qrToken}`);
        localStorage.removeItem(getParticipantStorageKey());
        localStorage.removeItem(getWaitingRoomStorageKey());
        sessionStorage.removeItem(`quiz-session-${id}`);

        // Also clear old format
        localStorage.removeItem(`waiting-room-${id}-${qrToken}`);

        console.log('✅ All storage cleared after successful submission');

        // Store result for display
        localStorage.setItem(
          `quiz-result-${id}-${qrToken}`,
          JSON.stringify({
            ...data.result,
            participantName: participant.nama_siswa,
            pesertaId: participant.peserta_id,
            ...(typeof data.aiGradingFallbackNote === 'string' ? { aiGradingFallbackNote: data.aiGradingFallbackNote } : {}),
          }),
        );

        // Navigate to result page
        router.push(`/quiz/${id}/result?token=${qrToken}&pesertaId=${participant.peserta_id}`);
      } catch (err: any) {
        console.error('Submit error:', err);
        hasSubmittedRef.current = false;
        setError(err.message || 'Gagal mengirim jawaban');
        setSubmitting(false);
        setAutoSubmitting(false);
      }
    },
    [participant, answers, id, qrToken, router, getParticipantStorageKey, getWaitingRoomStorageKey],
  );

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0 || loading) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (!hasSubmittedRef.current) {
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, loading, handleSubmit]);

  useEffect(() => {
    if (!id || !qrToken) {
      setError('Token tidak valid');
      return;
    }
    fetchQuiz();
  }, [id, qrToken]);

  // Warn before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmittedRef.current && Object.keys(answers).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers]);

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
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.soal_id]: answer,
    }));
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleQuestionJump = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const getTimeColor = () => {
    if (timeRemaining <= 60) return 'bg-red-500';
    if (timeRemaining <= 300) return 'bg-amber-500';
    return 'bg-cyan-500';
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
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (autoSubmitting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Waktu Habis!</h1>
          <p className="text-sm text-gray-500 mb-6">Jawaban Anda sedang dikumpulkan secara otomatis...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">SEMANGAT!!</p>
              <h1 className="text-xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
            </div>

            <div className="flex items-center gap-4">
              {saveStatus && (
                <span className={`text-xs ${saveStatus === 'saved' ? 'text-emerald-500' : saveStatus === 'saving' ? 'text-gray-400' : 'text-red-500'}`}>
                  {saveStatus === 'saved' ? 'Tersimpan' : saveStatus === 'saving' ? 'Menyimpan...' : 'Gagal menyimpan'}
                </span>
              )}

              <div className={`flex items-center gap-2 px-5 py-2.5 ${getTimeColor()} text-white rounded-full transition-colors`}>
                <Clock className="w-5 h-5" />
                <span className="font-bold">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {currentQuestion ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800">Soal {currentQuestionIndex + 1}.</h2>
                    <span className="text-xs text-gray-400 uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-full">
                      {currentQuestion.tipe_soal === 'pilihan_ganda'
                        ? 'Pilihan Ganda'
                        : currentQuestion.tipe_soal === 'isian_singkat'
                          ? 'Isian Singkat'
                          : 'Uraian'}
                    </span>
                  </div>
                  <div className="text-gray-700 leading-relaxed">{formatText(currentQuestion.teks_soal)}</div>
                </div>

                {currentQuestion.tipe_soal === 'pilihan_ganda' && currentQuestion.pilihan && (
                  <div className="space-y-4 mb-8">
                    {currentQuestion.pilihan.map((option, index) => {
                      const label = String.fromCharCode(65 + index);
                      const isSelected = answers[currentQuestion.soal_id] === option.teks_pilihan;

                      return (
                        <button
                          key={option.pilihan_id}
                          onClick={() => handleAnswerSelect(option.teks_pilihan)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-cyan-400 bg-cyan-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${isSelected ? 'bg-cyan-400 text-white' : 'bg-cyan-400 text-white'}`}>{label}</div>
                          <span className="text-gray-700 font-medium">{option.teks_pilihan}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {(currentQuestion.tipe_soal === 'uraian' || currentQuestion.tipe_soal === 'isian_singkat') && (
                  <div className="mb-8">
                    <textarea
                      value={answers[currentQuestion.soal_id] || ''}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      rows={currentQuestion.tipe_soal === 'isian_singkat' ? 4 : 8}
                      placeholder={
                        currentQuestion.tipe_soal === 'isian_singkat'
                          ? 'Tulis jawaban singkat Anda...'
                          : 'Tulis jawaban Anda di sini dengan lengkap dan jelas...'
                      }
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-2">{(answers[currentQuestion.soal_id] || '').length} karakter</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-4 mt-8">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="px-8 py-3 bg-red-400 hover:bg-red-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  {currentQuestionIndex === totalQuestions - 1 ? (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      disabled={submitting}
                      className="px-8 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Kumpulkan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-8 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Tidak ada soal tersedia</div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">NAMA LENGKAP:</p>
              <h3 className="text-lg font-bold text-gray-800">{participant?.nama_siswa || 'Siswa'}</h3>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Navigasi Soal</p>
              <div className="grid grid-cols-6 gap-2">
                {shuffledQuestions.map((q, index) => {
                  const isAnswered = answers[q.soal_id] !== undefined && answers[q.soal_id] !== '';
                  const isCurrent = index === currentQuestionIndex;

                  return (
                    <button
                      key={q.soal_id}
                      onClick={() => handleQuestionJump(index)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${isCurrent ? 'bg-cyan-400 text-white' : isAnswered ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-500 mb-3">Keterangan:</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-cyan-400"></div>
                  <span className="text-gray-600">Soal saat ini</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-cyan-100"></div>
                  <span className="text-gray-600">Sudah dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100"></div>
                  <span className="text-gray-600">Belum dijawab</span>
                </div>
              </div>
            </div>

            <button onClick={() => setShowConfirmSubmit(true)} disabled={submitting} className="w-full py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50">
              Kumpulkan
            </button>

            <div className="mt-4 text-center text-sm text-gray-500">
              {answeredCount} dari {totalQuestions} soal terjawab
            </div>
          </div>
        </div>
      </div>

      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Konfirmasi Pengumpulan</h2>
            <p className="text-gray-600 text-center mb-2">
              Anda telah menjawab {answeredCount} dari {totalQuestions} soal.
            </p>
            {answeredCount < totalQuestions && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-amber-700 text-sm text-center flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Masih ada {totalQuestions - answeredCount} soal yang belum dijawab!
                </p>
              </div>
            )}
            <p className="text-gray-600 text-center mb-6">Apakah Anda yakin ingin mengumpulkan jawaban?</p>

            <div className="flex gap-4">
              <button onClick={() => setShowConfirmSubmit(false)} disabled={submitting} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-colors disabled:opacity-50">
                Batal
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} className="flex-1 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full transition-colors disabled:opacity-50">
                {submitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
