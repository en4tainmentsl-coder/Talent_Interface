import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import { 
  LayoutDashboard, 
  UserCircle, 
  CalendarCheck, 
  LogOut, 
  Menu, 
  X,
  Bell,
  FileText,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { cn } from './utils';
import { AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ProfileEditor from './components/ProfileEditor';
import BookingManager from './components/BookingManager';
import Agreement from './components/Agreement';
import Contracts from './components/Contracts';
import InstallPrompt from './components/InstallPrompt';
import NotificationsPanel from './components/NotificationsPanel';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchNotifications(session.user.id);
        subscribeToNotifications(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchNotifications(session.user.id);
        subscribeToNotifications(session.user.id);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setNotifications(data);
  };

  const subscribeToNotifications = (userId: string) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    }
  };

  const markAllRead = async () => {
    if (!session?.user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .is('read_at', null);
    
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 space-y-8 text-center border border-gray-100">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-lg border border-gray-100 overflow-hidden p-2">
              <img 
                src="https://ik.imagekit.io/enfourreap/Picture1.png?updatedAt=1770550783858" 
                alt="Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900">En410</h1>
            <p className="text-gray-500 mt-2 font-medium">Find a gig for you.</p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={() => supabase.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                  scopes: 'https://www.googleapis.com/auth/calendar.events'
                }
              })}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            >
              Sign in with Google
            </button>
            <p className="text-xs text-gray-400">By signing in, you agree to our Terms of Service.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r transition-transform duration-300 md:relative md:translate-x-0",
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden p-1">
                  <img 
                    src="https://ik.imagekit.io/enfourreap/Picture1.png?updatedAt=1770550783858" 
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <span className="text-2xl font-black tracking-tighter">En410</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="md:hidden">
                <X className="w-6 h-6" />
              </button>
            </div>

              <nav className="flex-1 space-y-2">
                <NavItem to="/" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
                <NavItem to="/profile" icon={<UserCircle className="w-5 h-5" />} label="My Profile" />
                <NavItem to="/bookings" icon={<CalendarCheck className="w-5 h-5" />} label="Bookings" />
                <NavItem to="/contracts" icon={<Briefcase className="w-5 h-5" />} label="Contracts" />
                <NavItem to="/agreement" icon={<ShieldCheck className="w-5 h-5" />} label="Agreement" />
              </nav>

            <div className="pt-6 border-t mt-auto">
              <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-gray-50 rounded-2xl">
                <img 
                  src={session.user.user_metadata.avatar_url} 
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  alt="Avatar"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{session.user.user_metadata.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                </div>
              </div>
              <button 
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-2xl transition-colors font-bold text-sm"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-auto">
          {/* Header */}
          <header className="h-20 bg-white/80 backdrop-blur-md border-b sticky top-0 z-40 px-8 flex items-center justify-between">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Artist Portal</h2>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsNotificationsOpen(true)}
                className="p-2 text-gray-400 hover:text-black transition-colors relative"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
              <Link to="/profile" className="flex items-center gap-2 group">
                <span className="text-sm font-bold group-hover:text-emerald-600 transition-colors">Settings</span>
              </Link>
            </div>
          </header>

            <div className="p-4 md:p-8">
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profile" element={<ProfileEditor />} />
                  <Route path="/bookings" element={<BookingManager />} />
                  <Route path="/contracts" element={<Contracts />} />
                  <Route path="/agreement" element={<Agreement />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AnimatePresence>
            </div>
        </main>
      </div>

      <NotificationsPanel 
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={markAsRead}
        onMarkAllRead={markAllRead}
      />
      <InstallPrompt />
    </Router>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm",
        isActive 
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" 
          : "text-gray-500 hover:bg-gray-100 hover:text-black"
      )}
    >
      {icon}
      {label}
    </NavLink>
  );
}
