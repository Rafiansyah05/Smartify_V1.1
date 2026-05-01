'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { Navbar } from '@/components/dashboard/Navbar';

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Navbar />

      {/* Main Content */}
      <main className="transition-all duration-300 pt-16 ml-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
