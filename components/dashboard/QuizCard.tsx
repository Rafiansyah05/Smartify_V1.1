import Link from 'next/link';
import { FileText, Calendar, MoreVertical } from 'lucide-react';

interface QuizCardProps {
  id: number;
  title: string;
  totalSoal: number;
  tanggal: string;
  kelas?: string;
  status?: 'draft' | 'published' | 'ongoing';
  jumlahPeserta?: number;
}

export function QuizCard({
  id,
  title,
  totalSoal,
  tanggal,
  kelas = 'KELAS 10 IPA',
  status = 'published',
  jumlahPeserta = 0,
}: QuizCardProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow duration-200">
      {/* Cyan top border */}
      <div className="h-1.5 bg-primary" />

      <div className="p-5">
        {/* Header with badge and menu */}
        <div className="flex items-start justify-between mb-3">
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-md">
            {kelas}
          </span>
          <button className="p-1 rounded-lg hover:bg-gray-50 transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Title */}
        <Link href={`/quiz/${id}`}>
          <h3 className="text-base font-semibold text-gray-800 mb-4 line-clamp-2 hover:text-primary transition-colors">
            {title}
          </h3>
        </Link>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>{totalSoal} Soal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{tanggal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
