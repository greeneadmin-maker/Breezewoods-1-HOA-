import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Loader2, TrendingUp, Users, AlertCircle, Wallet } from 'lucide-react';

export const Dashboard = () => {
    const { user, accessToken } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({
        collectionsByMonth: {} as Record<string, number>,
        collectionsByCollector: {} as Record<string, number>
    });
    const [homeowners, setHomeowners] = useState<any[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    ...(accessToken ? { 'X-Google-Access-Token': accessToken } : {})
                };

                const [statsRes, homeownersRes] = await Promise.all([
                    fetch('/api/dashboard-stats', { headers }),
                    fetch('/api/homeowners', { headers })
                ]);

                if (!statsRes.ok || !homeownersRes.ok) {
                    throw new Error('Failed to fetch dashboard data');
                }

                const statsData = await statsRes.json();
                const homeownersData = await homeownersRes.json();

                setStats(statsData);
                setHomeowners(homeownersData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, accessToken]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            </div>
        );
    }

    // Process data for charts
    const monthlyData = Object.entries(stats.collectionsByMonth || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

    const collectorData = Object.entries(stats.collectionsByCollector || {})
        .map(([name, amount]) => ({ name: name.split('@')[0], amount }))
        .sort((a, b) => b.amount - a.amount);

    // Delinquency Data
    const updatedCount = homeowners.filter(h => h.status === 'Updated' || String(h.status).includes('Fully Paid')).length;
    const delinquentCount = homeowners.filter(h => String(h.status).includes('Delinquent') || String(h.status).includes('Delayed')).length;
    const pendingCount = homeowners.length - updatedCount - delinquentCount;
    
    // Estimate outstanding balance (assume 500 per delayed month roughly, or just report total users)
    const delayedRegex = /(\d+)\s+Month/;
    let estimatedUnpaidMonths = 0;
    homeowners.forEach(h => {
        if (h.status === 'Delinquent') {
            estimatedUnpaidMonths += 3; // at least 3
        } else if (String(h.status).includes('Delayed')) {
            const match = String(h.status).match(delayedRegex);
            if (match) estimatedUnpaidMonths += parseInt(match[1], 10);
        }
    });
    const estOutstanding = estimatedUnpaidMonths * 500;

    const rateData = [
        { name: 'Updated', value: updatedCount, color: '#10b981' },
        { name: 'Delinquent/Delayed', value: delinquentCount, color: '#ef4444' },
    ].filter(d => d.value > 0);
    
    if (pendingCount > 0) {
        rateData.push({ name: 'Pending/Unknown', value: pendingCount, color: '#cbd5e1' });
    }

    const totalCollected = Object.values(stats.collectionsByMonth || {}).reduce((a, b) => a + (b as number), 0);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-7xl mx-auto w-full space-y-8"
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard & Analytics</h1>
                <p className="text-slate-500 mt-1">Overview of collections and delinquency metrics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-100 p-3 rounded-full shrink-0">
                            <Wallet className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Collections</p>
                            <h3 className="text-2xl font-bold text-slate-900">₱{totalCollected.toLocaleString()}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-full shrink-0">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Residents</p>
                            <h3 className="text-2xl font-bold text-slate-900">{homeowners.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-100 p-3 rounded-full shrink-0">
                            <TrendingUp className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Updated Residents</p>
                            <h3 className="text-2xl font-bold text-slate-900">{updatedCount}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-rose-100 p-3 rounded-full shrink-0">
                            <AlertCircle className="w-6 h-6 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Est. Outstanding</p>
                            <h3 className="text-2xl font-bold text-slate-900">₱{estOutstanding.toLocaleString()}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Collection Overview</h3>
                    <div className="h-[300px] w-full">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(value) => `₱${value}`} />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        formatter={(value: any) => [`₱${Number(value).toLocaleString()}`, 'Collections']}
                                    />
                                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                No collection data available yet.
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Delinquency Rate</h3>
                    <div className="h-[300px] w-full relative">
                        {homeowners.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={rateData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {rateData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                No data available.
                            </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-slate-900">
                                {homeowners.length > 0 ? Math.round((updatedCount / homeowners.length) * 100) : 0}%
                            </span>
                            <span className="text-xs text-slate-500 font-medium">Updated</span>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {rateData.map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                    <span className="text-slate-600">{d.name}</span>
                                </div>
                                <span className="font-semibold text-slate-900">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Collector Performance</h3>
                {collectorData.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {collectorData.map((collector, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                        {collector.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-slate-700 truncate max-w-[120px]">{collector.name}</span>
                                </div>
                                <span className="font-bold text-slate-900">₱{collector.amount.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-400">
                        No collector data available yet.
                    </div>
                )}
            </Card>
        </motion.div>
    );
};
