'use client';

import { useState, useEffect } from 'react';
import { QuizCard } from '@/components/dashboard/QuizCard';
import { Search, FileText, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchQuizzes = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
      } else if (res.status === 401) {
        window.location.href = '/auth/login';
      }
    } catch (err) {
      console.error('Fetch quizzes error:', err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Helper untuk format tanggal
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredQuizzes = quizzes.filter((quiz) => quiz.judul?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">DASHBOARD</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-bold text-card-foreground sm:text-2xl">Koleksi Kuis Saya</h1>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative w-full sm:max-w-xs lg:w-80">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Cari kuis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border-0 bg-input py-3 pl-12 pr-4 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex items-center rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4 ${
                  viewMode === 'grid' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-initial sm:px-4 ${
                  viewMode === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'}>
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.kuis_id}
              id={quiz.kuis_id}
              title={quiz.judul}
              totalSoal={quiz.total_soal}
              tanggal={formatDate(quiz.created_at)}
              copyright={quiz.kelas || 'Smartify Quiz'}
              status={quiz.status || 'draft'}
              onDeleted={() => fetchQuizzes({ silent: true })}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredQuizzes.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800">Belum ada kuis</h3>
          <p className="text-gray-500 mt-1 mb-4">Mulai buat kuis pertama Anda</p>
          <Link
            href="/generate"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Buat Kuis Baru
          </Link>
        </div>
      )}
    </div>
  );
}
