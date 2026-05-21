import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users, Home, FileText, Loader2, Menu, X, BarChart, Shield, FileCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

export const Layout = () => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role === 'Pending') {
    return <Navigate to="/pending" replace />;
  }

  const navItems = [
    { name: 'Dashboard', icon: BarChart, path: '/dashboard', roles: ['Admin', 'President'] },
    { name: 'Directory', icon: Home, path: '/', roles: ['Admin', 'President', 'Collector'] },
    { name: 'Pending Proofs', icon: FileCheck, path: '/proofs', roles: ['Admin', 'President'] },
    { name: 'User Management', icon: Users, path: '/users', roles: ['Admin'] },
    { name: 'Legal & Security', icon: Shield, path: '/legal', roles: ['Admin', 'President', 'Collector'] },
  ];

  const allowedNavItems = navItems.filter(item => item.roles.includes(profile.role));

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Breezewoods 1</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">HOA Ledger</p>
          </div>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
          <X className="h-6 w-6" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {allowedNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-slate-800 text-white" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-8 w-8 border border-slate-700">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback className="bg-slate-800 text-xs">{profile.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="truncate">
              <p className="text-sm font-medium text-slate-200 truncate">{profile.name}</p>
              <p className="text-xs text-slate-400 truncate">{profile.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400 hover:text-white hover:bg-slate-800 shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold">Breezewoods 1</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-300 hover:text-white p-1">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col shadow-xl z-10 shrink-0">
         <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
           <motion.aside
             initial={{ x: '-100%' }}
             animate={{ x: 0 }}
             exit={{ x: '-100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-slate-900 text-slate-100 flex flex-col shadow-2xl z-50 md:hidden"
           >
              <SidebarContent />
           </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col relative w-full h-full">
         <Outlet />
      </main>
    </div>
  );
};
