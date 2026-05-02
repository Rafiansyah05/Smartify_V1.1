'use client';

import { useState, useEffect } from 'react';
import { Bell, User, ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { ProfileModal } from '@/components/dashboard/ProfileModal';

interface UserData {
  user_id: number;
  email: string;
  nama: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface NavbarProps {
  fullWidth?: boolean;
  showBackButton?: boolean;
  backButtonText?: string;
}

export function Navbar({ fullWidth = false, showBackButton = false, backButtonText = 'Back to Dashboard' }: NavbarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Cek apakah halaman memiliki sidebar (dashboard)
  const hasSidebar = pathname?.startsWith('/dashboard') || pathname === '/dashboard';

  // Tentukan lebar navbar
  let navbarStyle = {};
  if (fullWidth) {
    navbarStyle = { left: 0 };
  } else if (hasSidebar) {
    navbarStyle = { left: '256px' };
  } else {
    navbarStyle = { left: 0 };
  }

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
        // Jika 401 (Unauthorized), itu normal untuk siswa yang tidak login
        // Tidak perlu error handling khusus
      } catch (err) {
        // Silent fail untuk siswa yang tidak login
        console.log('User not authenticated (likely student via QR)');
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

  const handleBack = () => {
    router.push('/dashboard');
  };

  // Untuk siswa yang tidak login (user null), tetap tampilkan avatar default
  const displayName = user?.nama || 'Siswa';
  const displayEmail = user?.email || '';

  return (
    <>
      <nav className="fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-100 transition-all duration-300 shadow-sm" style={navbarStyle}>
        <div className="flex items-center justify-between h-full px-6 gap-4">
          {/* Left section - Back Button */}
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button onClick={handleBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">{backButtonText}</span>
              </button>
            )}
          </div>

          {/* Right section - Notification & Profile */}
          <div className="flex items-center gap-4">
            {/* Notification - Sembunyikan untuk siswa yang tidak login */}
            {user && (
              <button className="relative p-2 rounded-full hover:bg-gray-50 transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
              </button>
            )}

            {/* Profile - Selalu tampilkan, dengan avatar default jika tidak login */}
            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 hover:border-primary transition-colors">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-cyan-600 text-white flex items-center justify-center font-medium text-sm">{user ? getInitials(user?.nama) : '?'}</div>
                )}
              </button>

              {/* Dropdown Menu - Hanya tampilkan jika user login */}
              {showProfileMenu && user && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
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
        </div>
      </nav>

      {/* Profile Modal - Hanya tampilkan jika user login */}
      {user && <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} user={user} onUpdate={handleUpdateUser} />}
    </>
  );
}
