import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion } from 'motion/react';
import { FileCheck, Activity, CheckCircle, XCircle } from 'lucide-react';

export const ProofApprovals = () => {
    const { profile, accessToken } = useAuth();
    const [proofs, setProofs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState<string | null>(null);

    // Form inputs for approval
    const [monthCovered, setMonthCovered] = useState<Record<string, string>>({});
    
    useEffect(() => {
        fetchProofs();
    }, [accessToken]);

    const fetchProofs = async () => {
        if (!accessToken) return;
        try {
            const res = await fetch('/api/proofs', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            setProofs(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string, proof: any) => {
        if (!accessToken) return;
        
        let mCovered = monthCovered[id];
        if (status === 'Approved') {
            if (!mCovered) {
                alert("Please enter the 'Month Covered' (e.g. 2026-05) before approving.");
                return;
            }
            setApproving(id);
            try {
                // Post to ledger first
                const ledgerRes = await fetch(`/api/ledgers/${proof.homeownerId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        amount: proof.amount,
                        orNumber: proof.reference || 'N/A',
                        monthCovered: mCovered,
                        date: proof.date
                    })
                });
                
                if (!ledgerRes.ok) {
                    const err = await ledgerRes.json();
                    throw new Error(err.error || 'Failed to update ledger');
                }

                // Update status to Approved
                await fetch(`/api/proofs/${id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ status })
                });

                setProofs(proofs.filter(p => p.id !== id));
            } catch (e: any) {
                alert("Error: " + e.message);
            } finally {
                setApproving(null);
            }
        } else {
            // Rejecting
            try {
                await fetch(`/api/proofs/${id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ status: 'Rejected' })
                });
                setProofs(proofs.filter(p => p.id !== id));
            } catch (e: any) {
                alert("Error rejecting proof");
            }
        }
    };

    if (profile?.role === 'Pending') return null;

    return (
        <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                    <FileCheck className="w-8 h-8 text-blue-600" />
                    Pending Proofs
                </h1>
                <p className="text-slate-500 mt-2">Verify and approve resident proofs of payment.</p>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center text-slate-400">Loading pending proofs...</div>
            ) : proofs.length === 0 ? (
                <Card className="p-12 text-center flex flex-col items-center border-dashed">
                    <Activity className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900">All Caught Up</h3>
                    <p className="text-slate-500">There are no pending payment proofs to review at the moment.</p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {proofs.map(proof => (
                        <motion.div key={proof.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="p-6">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Resident</p>
                                            <p className="font-semibold text-slate-900">Block {proof.homeownerId}</p>
                                            <p className="text-sm text-slate-500">{proof.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Details</p>
                                            <p className="font-semibold text-emerald-600">₱{proof.amount.toLocaleString()}</p>
                                            <p className="text-sm text-slate-500">Date: {proof.date}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reference & Notes</p>
                                            <p className="text-sm font-medium text-slate-800">{proof.reference || 'None'}</p>
                                            {proof.notes && <p className="text-sm text-slate-500 border-l-2 pl-2 mt-1">{proof.notes}</p>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3 min-w-[240px] bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-600">Assign Month Covered</label>
                                            <Input 
                                                placeholder="YYYY-MM (e.g. 2026-05)" 
                                                value={monthCovered[proof.id] || ''} 
                                                onChange={e => setMonthCovered(prev => ({...prev, [proof.id]: e.target.value}))}
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <Button 
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => handleUpdateStatus(proof.id, 'Approved', proof)}
                                                disabled={approving === proof.id}
                                            >
                                                {approving === proof.id ? 'Saving...' : <><CheckCircle className="w-4 h-4 mr-2"/> Approve</>}
                                            </Button>
                                            <Button 
                                                className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 border-none"
                                                onClick={() => handleUpdateStatus(proof.id, 'Rejected', proof)}
                                                disabled={approving === proof.id}
                                            >
                                                <XCircle className="w-4 h-4 mr-2"/> Reject
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
