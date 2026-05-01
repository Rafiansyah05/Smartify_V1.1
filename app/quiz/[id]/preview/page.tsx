'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Edit2 } from 'lucide-react';
import Link from 'next/link';

export default function PreviewQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    fetchQuizData();
  }, [id]);

  const fetchQuizData = async () => {
    try {
      const res = await fetch(`/api/quiz/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuiz(data.kuis);
        setQuestions(data.soal || []);
        setAuthorName(data.pembuat);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/quiz/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${quiz?.judul || 'Kuis'}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Gagal mendownload soal');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mendownload soal');
    }
  };

  const handleDelete = async (soalId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini?')) return;
    try {
      const res = await fetch(`/api/quiz/${id}/questions/${soalId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setQuestions(questions.filter(q => q.soal_id !== soalId));
      } else {
        alert('Gagal menghapus soal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      // Ubah status jadi published
      const res = await fetch(`/api/quiz/${id}/publish`, {
        method: 'POST'
      });
      if (res.ok) {
        router.push(`/quiz/${id}/waiting-room`);
      } else {
        alert('Gagal menyimpan kuis');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Header (No Sidebar/Navbar) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Generate Quiz &gt; Preview</p>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">{quiz?.judul}</h1>
            </div>
          </div>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Soal
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-6">
        {questions.map((q, index) => (
          <div key={q.soal_id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Soal {index + 1}.</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{q.teks_soal}</p>

            {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
              <div className="space-y-3 mb-8">
                {q.pilihan.map((p: any, pIndex: number) => {
                  const label = String.fromCharCode(65 + pIndex); // A, B, C, D...
                  return (
                    <div key={p.pilihan_id} className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold text-white ${p.is_benar ? 'bg-blue-500' : 'bg-blue-400'}`}>
                        {label}
                      </div>
                      <span className={p.is_benar ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}>
                        {p.teks_pilihan}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {q.tipe_soal === 'pilihan_ganda' && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Jawaban Benar</p>
                <div className="bg-green-100 dark:bg-green-900/30 px-4 py-3 rounded-lg flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-semibold">
                    {String.fromCharCode(65 + q.pilihan.findIndex((p:any) => p.is_benar))}
                  </div>
                  <span className="font-medium text-green-800 dark:text-green-400">
                    {q.pilihan.find((p:any) => p.is_benar)?.teks_pilihan}
                  </span>
                </div>
              </div>
            )}

            {q.tipe_soal === 'uraian' && q.kunci_jawaban && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Kunci Jawaban</p>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-4 rounded-lg">
                  <p className="text-green-800 dark:text-green-400 text-sm">{q.kunci_jawaban.jawaban_text}</p>
                </div>
              </div>
            )}

            {(q.tipe_soal === 'pilihan_ganda') && q.kunci_jawaban && (
                <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Penjelasan</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {q.kunci_jawaban.jawaban_text}
                    </p>
                </div>
            )}

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => handleDelete(q.soal_id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Hapus Soal
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Soal
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Fixed Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 z-30">
        <div className="max-w-5xl mx-auto flex justify-end">
          <button 
            onClick={handleSaveAndContinue}
            className="px-6 py-2.5 bg-[#4ac9ff] hover:bg-[#3bb8ec] text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            Simpan, dan lanjut &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
