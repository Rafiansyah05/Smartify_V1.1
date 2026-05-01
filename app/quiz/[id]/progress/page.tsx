'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function QuizProgressPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/quiz/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Gagal memuat kuis');
          return;
        }
        setQuiz(data.kuis);
        setQuestions(data.soal || []);
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan saat memuat kuis');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  const handleAnswerChange = (soalId: number, value: string) => {
    setAnswers((current) => ({ ...current, [soalId]: value }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/quiz/${id}/waiting-room`)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Kembali ke Waiting Room
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Progress Siswa</p>
              <h1 className="text-2xl font-bold text-gray-900">{quiz?.judul || 'Kuis'}</h1>
            </div>
          </div>
          <div className="rounded-3xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700">
            Status: <span className="font-semibold">{quiz?.status || 'unknown'}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl bg-red-50 border border-red-200 p-6 text-red-700">{error}</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
              <p className="text-sm text-gray-500 mb-4">Siswa dapat langsung mengerjakan kuis berikut ini.</p>

              {questions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-slate-50 p-6 text-center text-sm text-gray-500">Tidak ada soal tersedia.</div>
              ) : (
                <div className="space-y-6">
                  {questions.map((soal, index) => (
                    <div key={soal.soal_id} className="rounded-3xl border border-gray-200 bg-slate-50 p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Soal {index + 1}</p>
                          <h2 className="text-lg font-semibold text-gray-900">{soal.pertanyaan || soal.judul || 'Tidak ada pertanyaan'}</h2>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 border border-gray-200">{soal.tipe_soal === 'pilihan_ganda' ? 'Pilihan Ganda' : 'Uraian'}</span>
                      </div>

                      {soal.tipe_soal === 'pilihan_ganda' ? (
                        <div className="space-y-3">
                          {(soal.pilihan || []).map((pil: any) => (
                            <label key={pil.pilihan_id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50">
                              <input
                                type="radio"
                                name={`question-${soal.soal_id}`}
                                value={pil.jawaban_text}
                                checked={answers[soal.soal_id] === pil.jawaban_text}
                                onChange={() => handleAnswerChange(soal.soal_id, pil.jawaban_text)}
                                className="h-4 w-4 text-primary ring-1 ring-inset ring-gray-300"
                              />
                              <span className="text-sm text-gray-700">{pil.jawaban_text}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={answers[soal.soal_id] || ''}
                          onChange={(event) => handleAnswerChange(soal.soal_id, event.target.value)}
                          rows={6}
                          placeholder="Tulis jawaban di sini..."
                          className="w-full rounded-3xl border border-gray-200 bg-white p-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-600">Selesaikan semua jawaban dan kirim ketika siap.</p>
                  <p className="text-xs text-gray-400">Jawaban belum tersimpan ke server pada halaman ini.</p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitted || questions.length === 0}
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitted ? 'Terkirim' : 'Kirim Jawaban'}
                </button>
              </div>
              {submitted && <div className="mt-4 rounded-3xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">Jawaban berhasil dicatat secara lokal. Anda bisa menunggu hasil penilaian.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
