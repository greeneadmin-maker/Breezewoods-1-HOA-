import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, FileText, CheckCircle2, History, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useParams } from 'react-router-dom';

export const Portal = () => {
    const { id } = useParams<{ id: string }>();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [homeowner, setHomeowner] = useState<any>(null);
    const [ledger, setLedger] = useState<any[]>([]);

    useEffect(() => {
        const fetchPortalData = async () => {
            if (!id) {
                setError("Invalid access link.");
                setLoading(false);
                return;
            }

            try {
                // Decode the B64 id back to the standard BW1-B1L1 format
                const decodedId = atob(id);
                
                const res = await fetch(`/api/public/portal/${decodedId}`);
                const data = await res.json();
                
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to find records.');
                }
                
                setHomeowner(data.homeowner);
                setLedger(data.ledger || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPortalData();
    }, [id]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 relative">
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-100/40 mix-blend-multiply blur-3xl" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-slate-200/50 mix-blend-multiply blur-3xl" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-12 min-h-screen flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl tracking-tight text-slate-900">Breezewoods 1</h1>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Resident Portal</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        {loading && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-4"
                            >
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                <p className="text-slate-500 font-medium">Loading ledger...</p>
                            </motion.div>
                        )}
                        
                        {!loading && error && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full max-w-md p-8 bg-white rounded-xl shadow-xl border border-red-100 mx-auto text-center"
                            >
                                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h3>
                                <p className="text-slate-600 mb-6">{error}</p>
                            </motion.div>
                        )}

                        {!loading && homeowner && (
                            <motion.div
                                key="dashboard-step"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Sidebar Status */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <Card className="p-6 border-slate-200 shadow-xl shadow-slate-100">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xl text-slate-600">
                                                    {homeowner.name ? homeowner.name.substring(0, 1) : '?'}
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-slate-900">{homeowner.name || 'Unknown'}</h2>
                                                    <p className="text-slate-500 text-sm">BW1-B{homeowner.block}L{homeowner.lot}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Account Status</p>
                                                    <div className="flex items-center gap-2">
                                                        {homeowner.status === 'Updated' ? (
                                                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Updated
                                                            </Badge>
                                                        ) : homeowner.status === 'Delinquent' ? (
                                                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border border-rose-200">
                                                                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Delinquent
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-200">
                                                                <History className="w-3.5 h-3.5 mr-1" /> {homeowner.status}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Last Covered Month</p>
                                                    <p className="font-mono text-slate-800 font-medium bg-slate-50 inline-block px-2 py-1 rounded border border-slate-100">
                                                        {homeowner.lastCoveredMonth || 'None'}
                                                    </p>
                                                </div>
                                            </div>
                                        </Card>
                                        
                                        <Card className="p-6 bg-blue-50 border-blue-100 text-blue-900">
                                            <h3 className="font-semibold flex items-center gap-2 mb-2">
                                                <InfoIcon /> Digital Ledger Note
                                            </h3>
                                            <p className="text-sm text-blue-800/80 leading-relaxed">
                                                This is a read-only view of your payment history. For disputes or missing payments, please present your Official Receipt (OR) to the HOA Administrator.
                                            </p>
                                        </Card>
                                    </div>

                                    {/* Main Ledger Area */}
                                    <div className="lg:col-span-2">
                                        <Card className="p-0 overflow-hidden shadow-xl shadow-slate-100 border-slate-200">
                                            <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                        <FileText className="w-5 h-5 text-blue-600" />
                                                        Payment History
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1">Official records synchronized with HOA Database.</p>
                                                </div>
                                                <Badge variant="outline" className="bg-slate-50">
                                                    {ledger.length} Record{ledger.length !== 1 ? 's' : ''}
                                                </Badge>
                                            </div>
                                            
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider font-semibold border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-6 py-4">Transaction Date</th>
                                                            <th className="px-6 py-4">Month Covered</th>
                                                            <th className="px-6 py-4">OR Number</th>
                                                            <th className="px-6 py-4 text-right">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {ledger.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <History className="w-8 h-8 text-slate-300 mb-3" />
                                                                        <p>No payments recorded in the system yet.</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            ledger
                                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                                .map((p, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                                    <td className="px-6 py-4 text-slate-900 font-medium">
                                                                        {p.date ? new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-slate-600">
                                                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">{p.monthCovered}</span>
                                                                    </td>
                                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                                                        {p.orNumber}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                                                                        ₱{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
