'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Edit2, Bell, ArrowRight } from 'lucide-react';

export default function PreviewQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [user, setUser] = useState<{ nama?: string; email?: string } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    fetchQuizData();
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {}
  };

  const fetchQuizData = async () => {
    try {
      const res = await fetch(`/api/quiz/${id}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Quiz data:', data); // Debug: lihat di console
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
        setQuestions(questions.filter((q) => q.soal_id !== soalId));
      } else {
        alert('Gagal menghapus soal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!id) {
      alert('ID kuis tidak valid');
      return;
    }

    try {
      const url = new URL(`/api/quiz/${id}/waiting-room`, window.location.origin);
      const res = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        router.push(`/quiz/${id}/waiting-room`);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan kuis');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan kuis');
    }
  };

  const handleBack = () => {
    router.back();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition-colors">
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 mt-8">
        {/* Title Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">GENERATE QUIZ {'>'} PREVIEW</p>
              <h1 className="text-2xl font-bold text-gray-800">{quiz?.judul || 'Ulangan Harian'}</h1>
            </div>
            <button onClick={handleDownload} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white rounded-full font-medium transition-colors">
              <Download className="w-4 h-4" />
              Download Soal
            </button>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-10">
          {questions.map((q, index) => (
            <div key={q.soal_id} className="pb-8 border-b border-gray-100 last:border-b-0 last:pb-0">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Soal {index + 1}.</h3>
              <div className="text-gray-700 mb-6 leading-relaxed">{formatText(q.teks_soal)}</div>

              {/* Pilihan Ganda Options */}
              {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                <div className="space-y-4 mb-8">
                  {q.pilihan.map((p: any, pIndex: number) => {
                    const label = String.fromCharCode(65 + pIndex);
                    return (
                      <div key={p.pilihan_id} className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-400 text-white text-sm font-bold flex-shrink-0">{label}</div>
                        <span className="text-gray-700 font-medium">{p.teks_pilihan}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Jawaban Benar untuk Pilihan Ganda */}
              {q.tipe_soal === 'pilihan_ganda' && q.pilihan && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Jawaban Benar</p>
                  <div className="bg-emerald-100 px-5 py-3.5 rounded-xl flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex-shrink-0">{String.fromCharCode(65 + q.pilihan.findIndex((p: any) => p.is_benar))}</div>
                    <span className="font-semibold text-gray-800">{q.pilihan.find((p: any) => p.is_benar)?.teks_pilihan}</span>
                  </div>
                </div>
              )}

              {/* PENJELASAN DARI GEMINI - TAMPIL UNTUK SEMUA TIPE SOAL */}
              {q.kunci_jawaban?.jawaban_text && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Penjelasan Jawaban</p>
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                    <div className="text-emerald-800 text-sm leading-relaxed">{formatText(q.kunci_jawaban.jawaban_text)}</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button onClick={() => handleDelete(q.soal_id)} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-full font-medium transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Hapus Soal
                </button>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-cyan-50 text-cyan-500 hover:bg-cyan-100 rounded-full font-medium transition-colors">
                  <Edit2 className="w-4 h-4" />
                  Edit Soal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleSaveAndContinue}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-white font-semibold rounded-full shadow-lg shadow-cyan-400/30 transition-all hover:shadow-xl hover:shadow-cyan-400/40"
        >
          Simpan, dan lanjut
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
