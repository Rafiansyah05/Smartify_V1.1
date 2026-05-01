'use client';

import { useState, useEffect } from 'react';
import { Bell, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [user, setUser] = useState<{ nama?: string; email?: string } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {}
    }
    fetchUser();
  }, []);

  useEffect(() => {
    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
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

  return (
    <nav
      className="fixed top-0 right-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-all duration-300"
      style={{ left: '256px' }}
    >
      <div className="flex items-center justify-end h-full px-6 gap-3">
        {/* Notification */}
        <button className="relative p-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Dark Mode Toggle */}
        <button 
          onClick={toggleDarkMode}
          className="relative p-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <Moon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 dark:border-gray-700 hover:border-primary transition-colors"
          >
            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center font-medium text-sm">
              {getInitials(user?.nama)}
            </div>
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{user?.nama || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
