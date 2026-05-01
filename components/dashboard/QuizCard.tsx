import Link from 'next/link';
import { FileText, Clock, Users, MoreVertical } from 'lucide-react';

interface QuizCardProps {
  id: number;
  title: string;
  totalSoal: number;
  tanggal: string;
  status?: 'draft' | 'published' | 'ongoing';
  jumlahPeserta?: number;
}

export function QuizCard({ id, title, totalSoal, tanggal, status = 'published', jumlahPeserta = 0 }: QuizCardProps) {
  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header dengan gradient */}
      <div className="h-2 bg-gradient-to-r from-blue-400 to-blue-600"></div>
      
      <div className="p-5">
        {/* Title and Menu */}
        <div className="flex justify-between items-start mb-3">
          <Link href={`/quiz/${id}`} className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1">
              {title}
            </h3>
          </Link>
          <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
            <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <FileText className="w-4 h-4" />
            <span>{totalSoal} Soal</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{tanggal}</span>
          </div>
          {jumlahPeserta > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Users className="w-4 h-4" />
              <span>{jumlahPeserta} Siswa</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex justify-between items-center">
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
            {status === 'draft' ? 'Draft' : status === 'published' ? 'Published' : 'Berlangsung'}
          </span>
          
          <Link
            href={`/quiz/${id}`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
          >
            Lihat Detail →
          </Link>
        </div>
      </div>
    </div>
  );
}