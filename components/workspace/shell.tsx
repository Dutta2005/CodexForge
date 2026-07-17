'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import { Menu, X, LayoutDashboard, GitBranch, Share2, Cpu, History, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/repositories', label: 'Repositories', icon: GitBranch },
  { href: '/architecture', label: 'Architecture', icon: Share2 },
  { href: '/tasks', label: 'AI Tasks', icon: Cpu },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    setMounted(true);
    // Fetch user on mount if we don't have one
    api.authMe().then((res) => {
      setUser(res);
    }).catch(() => {});
  }, [setUser]);

  const NavLinks = () => (
    <>
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            href={item.href}
            key={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-forge-accent/10 text-forge-accent shadow-[inset_2px_0_0_0_rgba(16,185,129,1)]" 
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-forge-bg text-slate-100 font-sans selection:bg-forge-accent selection:text-black flex flex-col md:flex-row">
      {/* Background gradients */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,166,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_40%)]" />

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-forge-border bg-forge-surface/30 p-6 backdrop-blur-xl md:flex z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-forge-teal to-forge-accent flex items-center justify-center">
            <Cpu className="h-5 w-5 text-black" />
          </div>
          <Link href="/" className="text-2xl font-bold tracking-tight text-white">
            Codex<span className="text-forge-accent">Forge</span>
          </Link>
        </div>
        
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold pl-10">Workspace</p>
        
        <nav className="mt-10 flex flex-1 flex-col gap-1.5">
          <NavLinks />
        </nav>
        
        <div className="mt-auto border-t border-forge-border pt-4">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
            {user ? (
              <>
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-6 w-6 rounded-full" /> : <User className="h-4 w-4" />}
                <span className="truncate">{user.login}</span>
              </>
            ) : (
              <>
                <User className="h-4 w-4" />
                <span>GitHub OAuth</span>
              </>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-forge-border bg-forge-bg/80 px-4 backdrop-blur-md md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-forge-teal to-forge-accent flex items-center justify-center">
            <Cpu className="h-4 w-4 text-black" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Codex<span className="text-forge-accent">Forge</span>
          </span>
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-20 flex flex-col gap-2 border-b border-forge-border bg-forge-surface p-4 shadow-xl md:hidden"
          >
            <NavLinks />
            <div className="mt-2 border-t border-forge-border pt-2">
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200">
                {user ? (
                  <>
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-6 w-6 rounded-full" /> : <User className="h-4 w-4" />}
                    <span className="truncate">{user.login}</span>
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    <span>GitHub OAuth</span>
                  </>
                )}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64">
        {/* Desktop Sticky Header */}
        <header className="sticky top-0 z-10 hidden h-16 w-full items-center justify-between border-b border-forge-border bg-forge-bg/60 px-8 backdrop-blur-md md:flex">
          <div className="flex items-center text-sm text-slate-400">
            <span className="text-forge-accent mr-2">/</span>
            {pathname === '/' ? 'Home' : pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2)}
          </div>
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 animate-pulse rounded-full bg-forge-accent shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-xs font-medium text-slate-400">System Online</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-8">
          <AnimatePresence mode="wait">
            {mounted && (
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
