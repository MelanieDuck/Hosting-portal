import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export type AdminPageKey = 'admin-dashboard' | 'admin-client-detail';

export function AdminLayout({
  current,
  onBackToList,
  children,
}: {
  current: AdminPageKey;
  onBackToList: () => void;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-slate-800">
          <Logo className="w-9 h-9" />
          <div>
            <p className="text-sm font-bold text-white">HostPortal</p>
            <p className="text-xs text-slate-400">Merchant Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={onBackToList}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              current === 'admin-dashboard'
                ? 'bg-white text-slate-900'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Client List
          </button>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-semibold">
              {(user?.email ?? 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Merchant</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Logo className="w-9 h-9" />
          <span className="text-sm font-bold text-white">Merchant</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-slate-800 text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-slate-900/60" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-16 left-0 right-0 bg-slate-900 p-3 space-y-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { onBackToList(); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-slate-800"
            >
              <Users className="w-5 h-5" />
              Client List
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
          {current === 'admin-client-detail' && (
            <button
              onClick={onBackToList}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to client list
            </button>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
