'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Clock, Target, BookOpen, Settings } from 'lucide-react';

export default function GenerateQuizPage() {
  const router = useRouter();
  const [quizType, setQuizType] = useState('pilihan_ganda');
  const [difficulty, setDifficulty] = useState('medium');
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [duration, setDuration] = useState(60);
  const [kkm, setKkm] = useState(70);
  const [title, setTitle] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError('');
    } else {
      setError('Hanya file PDF yang diperbolehkan');
      setFile(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setError('Silakan upload materi PDF terlebih dahulu');
      return;
    }
    if (!title) {
      setError('Judul kuis harus diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', quizType);
      formData.append('difficulty', difficulty);
      formData.append('totalQuestions', totalQuestions.toString());
      formData.append('duration', duration.toString());
      formData.append('kkm', kkm.toString());

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal generate kuis');

      // Redirect ke preview page
      router.push(`/quiz/${data.quizId}/preview`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Generate Quiz</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Buat kuis baru dari dokumen PDF Anda</p>
      </div>

      {/* Upload PDF Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Upload Modul PDF</h2>
        </div>
        
        <input 
          type="file" 
          accept=".pdf" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            file ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
          }`}
        >
          <FileText className={`w-12 h-12 mx-auto mb-3 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
          {file ? (
            <div>
              <p className="text-gray-800 dark:text-white font-medium mb-1">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Klik atau drag file PDF ke sini</p>
              <p className="text-sm text-gray-400">Maksimal 10MB</p>
            </div>
          )}
        </div>
        
        {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
      </div>

      {/* Quiz Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Konfigurasi Kuis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Judul Kuis */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Judul Kuis
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Ujian Tengah Semester - Biologi"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Jenis Soal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jenis Soal
            </label>
            <select
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pilihan_ganda">Pilihan Ganda</option>
              <option value="uraian">Uraian/Essay</option>
              <option value="campuran">Campuran</option>
            </select>
          </div>

          {/* Tingkat Kesulitan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tingkat Kesulitan
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
          </div>

          {/* Jumlah Soal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jumlah Soal
            </label>
            <input
              type="number"
              value={isNaN(totalQuestions) ? '' : totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value ? parseInt(e.target.value) : 0)}
              min={1}
              max={100}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Durasi (menit) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Durasi Pengerjaan (menit)
            </label>
            <input
              type="number"
              value={isNaN(duration) ? '' : duration}
              onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value) : 0)}
              min={1}
              max={180}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* KKM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              KKM (Kriteria Ketuntasan Minimal)
            </label>
            <input
              type="number"
              value={isNaN(kkm) ? '' : kkm}
              onChange={(e) => setKkm(e.target.value ? parseInt(e.target.value) : 0)}
              min={0}
              max={100}
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Conditional: Jika campuran, tampilkan detail jumlah */}
        {quizType === 'campuran' && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Detail Jumlah Soal</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Jumlah Pilihan Ganda</label>
                <input type="number" min={0} max={isNaN(totalQuestions) ? 100 : totalQuestions} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Jumlah Uraian</label>
                <input type="number" min={0} max={isNaN(totalQuestions) ? 100 : totalQuestions} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800" />
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <button 
            onClick={handleGenerate}
            disabled={loading || !file || !title}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sedang Meng-generate Soal (Mohon Tunggu)...' : 'Buat Soal Sekarang!'}
          </button>
        </div>
      </div>
    </div>
  );
}