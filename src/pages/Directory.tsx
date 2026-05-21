import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, User as UserIcon, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';

interface Homeowner {
  id: string;
  name: string;
  block: string;
  lot: string;
  residentStatus: string;
  status: string;
  lastCoveredMonth: string;
}

export const Directory = () => {
    const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user, accessToken, signInWithGoogle } = useAuth();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newHomeowner, setNewHomeowner] = useState({ name: '', block: '', lot: '', residentStatus: 'Homeowner' });
    const [isAdding, setIsAdding] = useState(false);
    const [sheetUrl, setSheetUrl] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const fetchSheetInfo = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/sheet-info', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.setup) setSheetUrl(data.url);
            }
        } catch(e) {}
    };

    const fetchHomeowners = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const response = await fetch('/api/homeowners', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...(accessToken ? { 'X-Google-Access-Token': accessToken } : {})
                }
            });
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('NOT_SETUP');
                }
                const errBody = await response.text();
                throw new Error(`Failed to fetch owners (${response.status}): ${errBody}`);
            }
            const data = await response.json();
            setHomeowners(data);
            localStorage.setItem('cached_homeowners', JSON.stringify(data));
        } catch (err: any) {
            const cached = localStorage.getItem('cached_homeowners');
            if (cached && (err.message.includes('fetch') || err.message.includes('offline') || err.message.includes('Network') || err.name === 'TypeError')) {
                setHomeowners(JSON.parse(cached));
            } else {
                setError(err.message === 'NOT_SETUP' ? 'Spreadsheet not setup yet.' : err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSheetInfo();
        fetchHomeowners();
    }, [user, accessToken]);

    const handleGenerateSheet = async () => {
        if (!user || !accessToken) return;
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const response = await fetch('/api/setup-sheet', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Google-Access-Token': accessToken
                }
            });
            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Failed to generate sheet: ${errBody}`);
            }
            await fetchHomeowners();
        } catch(err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleAddHomeowner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!navigator.onLine) {
            setError("Cannot add or update residents in offline mode.");
            setIsAddModalOpen(false);
            return;
        }
        try {
            setIsAdding(true);
            const token = await user.getIdToken();
            const response = await fetch('/api/homeowners', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newHomeowner)
            });
            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Failed to add owner (${response.status}): ${errBody}`);
            }
            await fetchHomeowners();
            setIsAddModalOpen(false);
            setNewHomeowner({ name: '', block: '', lot: '', residentStatus: 'Homeowner' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAdding(false);
        }
    }

    const filtered = useMemo(() => {
        return homeowners.filter(h => 
            h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            h.block.toLowerCase().includes(searchTerm.toLowerCase()) || 
            h.lot.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [homeowners, searchTerm]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset to page 1 when searching
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-7xl mx-auto w-full relative"
        >
            {isOffline && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm"
                >
                    <div className="bg-orange-100 p-2 rounded-full">
                        <Loader2 className="w-5 h-5 text-orange-600 hidden" />
                        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238L3 3" />
                         </svg>
                    </div>
                    <div>
                        <span className="font-semibold block sm:inline text-orange-900">Offline Mode Active.</span>
                        <span className="sm:ml-2 text-orange-700">Displaying cached directory. Modifying homeowners requires an active connection.</span>
                    </div>
                </motion.div>
            )}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Homeowner Directory</h1>
                    <p className="text-slate-500 mt-1">Manage and view resident payment statuses.</p>
                    {sheetUrl && (
                        <motion.a 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            href={sheetUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 underline mt-2 block w-max"
                        >
                            Open External Google Sheet
                        </motion.a>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative w-full sm:w-72 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input 
                            placeholder="Search name, block or lot..." 
                            className="pl-9 bg-white shadow-sm transition-all focus:ring-2 focus:ring-blue-100"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform">
                        <Plus className="w-4 h-4" /> Update Resident
                    </Button>
                </div>
            </div>

            {error && error !== 'Spreadsheet not setup yet.' && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center"
                >
                    {error}
                    <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 transition-colors">×</button>
                </motion.div>
            )}

            {error === 'Spreadsheet not setup yet.' && (
                <Card className="p-8 text-center max-w-lg mx-auto mt-12 bg-slate-50 border-dashed">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                        <h2 className="text-xl font-semibold mb-2">No Google Sheets Connected</h2>
                        <p className="text-slate-500 mb-6 text-sm">
                            To store ledger and payment data, we need to generate a new Google Sheet to act as the database.
                        </p>
                        {accessToken ? (
                            <Button onClick={handleGenerateSheet} size="lg" disabled={loading} className="w-full sm:w-auto overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                    <motion.span 
                                        key={loading ? 'loading' : 'idle'}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {loading ? 'Generating...' : 'Generate Spreadsheet Now'}
                                    </motion.span>
                                </AnimatePresence>
                            </Button>
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded text-sm mb-4">
                                Please sign in with Google in the sidebar to authorize connecting to a Google Sheet.
                            </div>
                        )}
                    </motion.div>
                </Card>
            )}

            {!error && loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(itemsPerPage)].map((_, i) => (
                        <motion.div
                            key={`skeleton-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className="p-6 h-[132px] bg-slate-50 border-slate-100 relative overflow-hidden flex flex-col justify-between">
                                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                                <div className="flex gap-3 items-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-slate-200 rounded w-2/3" />
                                        <div className="h-3 bg-slate-200 rounded w-1/3" />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                                    <div className="h-5 bg-slate-200 rounded-full w-20" />
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="space-y-8">
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {paginated.map((homeowner, i) => (
                                <motion.div
                                    layout
                                    key={homeowner.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card 
                                        className="p-5 cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-blue-300 hover:-translate-y-1 group bg-white overflow-hidden relative"
                                        onClick={() => navigate(`/homeowner/${homeowner.id}`)}
                                    >
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        <div className="flex items-start justify-between mb-4 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                                                <UserIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{homeowner.name}</h3>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <div className="flex items-center text-xs text-slate-600 font-semibold uppercase tracking-wide">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1" />
                                                            Block {homeowner.block}, Lot {homeowner.lot}
                                                        </div>
                                                        <div className="text-[11px] font-medium uppercase ml-4 flex items-center gap-1.5 mt-0.5">
                                                            Status: 
                                                            <span className={`px-1.5 py-0.5 rounded ${homeowner.residentStatus === 'Homeowner' ? 'bg-amber-100/80 text-amber-700' : 'bg-purple-100/80 text-purple-700'}`}>
                                                                {homeowner.residentStatus}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 relative z-10">
                                            <div className="text-xs text-slate-500">
                                                Last Paid: <span className="font-medium text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">{homeowner.lastCoveredMonth}</span>
                                            </div>
                                            <Badge variant={homeowner.status === 'Updated' ? 'default' : homeowner.status === 'Delinquent' ? 'destructive' : 'secondary'} 
                                                className={homeowner.status === 'Updated' 
                                                    ? 'bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200 border border-emerald-200' 
                                                    : homeowner.status === 'Delinquent' ? 'bg-rose-100/80 text-rose-700 hover:bg-rose-200 border border-rose-200' : 'bg-amber-100/80 text-amber-700 hover:bg-amber-200 border border-amber-200'}>
                                                {homeowner.status}
                                            </Badge>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                    
                    {filtered.length === 0 && !loading && !error && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                            className="py-12 text-center text-slate-500 flex flex-col items-center gap-3"
                        >
                            <Search className="w-10 h-10 text-slate-300" />
                            <p>No homeowners found matching your search.</p>
                        </motion.div>
                    )}

                    {totalPages > 1 && !loading && !error && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex items-center justify-center gap-4 mt-8"
                        >
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                disabled={currentPage === 1}
                                className="w-24 group transition-all"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Prev
                            </Button>
                            <div className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/60">
                                Page <span className="text-slate-900">{currentPage}</span> of {totalPages}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                disabled={currentPage === totalPages}
                                className="w-24 group transition-all"
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </motion.div>
                    )}
                </div>
            )}

            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50"
                        >
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-xl font-semibold text-slate-900">Update Resident</h2>
                                <p className="text-sm text-slate-500 mt-1">Update homeowner details to modify or create a new record.</p>
                            </div>
                            <form onSubmit={handleAddHomeowner} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                                    <Input 
                                        required
                                        placeholder="e.g. John Dela Cruz"
                                        value={newHomeowner.name}
                                        onChange={e => setNewHomeowner({...newHomeowner, name: e.target.value})}
                                        className="focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Block</label>
                                        <Input 
                                            required
                                            placeholder="e.g. 1"
                                            value={newHomeowner.block}
                                            onChange={e => setNewHomeowner({...newHomeowner, block: e.target.value})}
                                            onBlur={() => {
                                                const existing = homeowners.find(h => h.block.toLowerCase() === newHomeowner.block.toLowerCase().trim() && h.lot.toLowerCase() === newHomeowner.lot.toLowerCase().trim());
                                                if (existing) {
                                                    setNewHomeowner(prev => ({ ...prev, name: existing.name || '', residentStatus: existing.residentStatus || 'Homeowner' }));
                                                }
                                            }}
                                            className="focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Lot</label>
                                        <Input 
                                            required
                                            placeholder="e.g. 15"
                                            value={newHomeowner.lot}
                                            onChange={e => setNewHomeowner({...newHomeowner, lot: e.target.value})}
                                            onBlur={() => {
                                                const existing = homeowners.find(h => h.block.toLowerCase() === newHomeowner.block.toLowerCase().trim() && h.lot.toLowerCase() === newHomeowner.lot.toLowerCase().trim());
                                                if (existing) {
                                                    setNewHomeowner(prev => ({ ...prev, name: existing.name || '', residentStatus: existing.residentStatus || 'Homeowner' }));
                                                }
                                            }}
                                            className="focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                                        <select 
                                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                            value={newHomeowner.residentStatus}
                                            onChange={e => setNewHomeowner({...newHomeowner, residentStatus: e.target.value})}
                                        >
                                            <option value="Homeowner">Homeowner</option>
                                            <option value="Tenant">Tenant</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6 -mx-6 px-6 -mb-6 pb-6 pt-6 bg-slate-50/50">
                                    <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="hover:bg-slate-100">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isAdding} className="min-w-[120px] relative overflow-hidden">
                                        <AnimatePresence mode="wait">
                                            <motion.span 
                                                key={isAdding ? 'adding' : 'idle'}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="flex items-center justify-center gap-2 shadow"
                                            >
                                                {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {isAdding ? 'Updating...' : 'Update Resident'}
                                            </motion.span>
                                        </AnimatePresence>
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

