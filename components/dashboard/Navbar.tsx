'use client';

import { useState, useEffect } from 'react';
import { Bell, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ProfileModal } from '@/components/dashboard/ProfileModal';

interface UserData {
  user_id: number;
  email: string;
  nama: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export function Navbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error('Fetch user error:', err);
      }
    }
    fetchUser();
  }, []);

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

  const handleUpdateUser = (updatedUser: UserData) => {
    setUser(updatedUser);
  };

  return (
    <>
      <nav className="fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-100 transition-all duration-300" style={{ left: '256px' }}>
        <div className="flex items-center justify-end h-full px-6 gap-4">
          {/* Notification */}
          <button className="relative p-2 rounded-full hover:bg-gray-50 transition-colors">
            <Bell className="w-5 h-5 text-gray-500" />
          </button>

          {/* Profile */}
          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 hover:border-primary transition-colors">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center font-medium text-sm">{getInitials(user?.nama)}</div>
              )}
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-800 truncate">{user?.nama || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
                </div>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Lihat Profile
                </button>
                <button onClick={handleLogout} className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-50 transition-colors">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} user={user} onUpdate={handleUpdateUser} />
    </>
  );
}
