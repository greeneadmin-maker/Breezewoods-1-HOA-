import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { motion } from 'motion/react';
import { Clock, LogOut } from 'lucide-react';

export const PendingApproval = () => {
  const { profile, signOut } = useAuth();

  if (profile?.role !== 'Pending') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-slate-200/50 mix-blend-multiply blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md p-8 bg-white/90 backdrop-blur-xl shadow-xl rounded-2xl border border-slate-100 text-center"
      >
        <div className="mx-auto bg-amber-100 text-amber-600 w-16 h-16 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">Approval Pending</h2>
        <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
          Your account has been created successfully, but it is currently awaiting activation by an Administrator. You will be able to access the system once a role is assigned to you.
        </p>
        <Button variant="outline" onClick={signOut} className="gap-2 w-full">
            <LogOut className="w-4 h-4" />
            Sign Out
        </Button>
      </motion.div>
    </div>
  );
};
