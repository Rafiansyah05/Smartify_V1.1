'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { Navbar } from '@/components/dashboard/Navbar';
import { useState, useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <Navbar />
      
      {/* Main Content */}
      <main
        className="transition-all duration-300 pt-16"
        style={{ marginLeft: sidebarOpen ? '256px' : '0' }}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}