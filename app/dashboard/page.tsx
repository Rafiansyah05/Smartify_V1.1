'use client';

import { useState, useEffect } from 'react';
import { QuizCard } from '@/components/dashboard/QuizCard';
import { Plus, Filter, Search, FileText } from 'lucide-react';
import Link from 'next/link';

// Mock data - nanti diganti dengan data dari database
const mockQuizzes = [
  { id: 1, title: 'Ujian Tengah Semester - Biologi', totalSoal: 20, tanggal: '12 Okt 2023', status: 'published', peserta: 32 },
  { id: 2, title: 'Ujian Akhir Semester - Matematika', totalSoal: 25, tanggal: '15 Nov 2023', status: 'published', peserta: 28 },
  { id: 3, title: 'Quiz Harian - Fisika', totalSoal: 10, tanggal: '05 Des 2023', status: 'draft', peserta: 0 },
  { id: 4, title: 'Try Out - Kimia', totalSoal: 40, tanggal: '20 Jan 2024', status: 'published', peserta: 45 },
  { id: 5, title: 'UH Bab 1 - Bahasa Indonesia', totalSoal: 15, tanggal: '10 Feb 2024', status: 'ongoing', peserta: 18 },
];

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchQuizzes() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data.quizzes || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuizzes();
  }, []);

  // Helper untuk format tanggal
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.judul?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Koleksi Kuis Saya</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola dan pantau semua kuis yang telah Anda buat</p>
        </div>
        
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Kuis Baru</span>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kuis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Filter className="w-4 h-4" />
          <span>Filter</span>
        </button>
      </div>

      {/* Quiz Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.kuis_id}
              id={quiz.kuis_id}
              title={quiz.judul}
              totalSoal={quiz.total_soal}
              tanggal={formatDate(quiz.created_at)}
              status={quiz.status || 'draft'}
              jumlahPeserta={0} // belum ada tabel peserta kuis yang nyambung di mockup ini
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredQuizzes.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-white">Belum ada kuis</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Mulai buat kuis pertama Anda</p>
          <Link
            href="/generate"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Buat Kuis Baru
          </Link>
        </div>
      )}
    </div>
  );
}