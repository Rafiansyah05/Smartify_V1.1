import { redirect } from 'next/navigation';

interface QuizPageProps {
  params: {
    id: string;
  };
}

export default function QuizPage({ params }: QuizPageProps) {
  return redirect(`/quiz/${params.id}/preview`);
}
