import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Printer, Download, MapPin, Calendar, Receipt, Loader2, Search, Filter, Info, WifiOff, Copy, Check, User, FileText } from 'lucide-react';
import { SOAGeneratorModal } from '../components/SOAModal';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { format } from 'date-fns';

const safeFormatDate = (dateString: string | undefined | null, dateFormat: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return format(date, dateFormat);
};

interface Payment {
  id: string;
  homeownerId: string;
  date: string;
  amount: number;
  orNumber: string;
  monthCovered: string;
}

export const HomeownerProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile, user, accessToken, signInWithGoogle, errorDetails } = useAuth();
    
    const [payments, setPayments] = useState<Payment[]>([]);
    const [homeowner, setHomeowner] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
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
    
    const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
    const [isSOAModalOpen, setIsSOAModalOpen] = useState(false);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [newPayment, setNewPayment] = useState({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      orNumber: '',
      monthCovered: ''
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [printMessage, setPrintMessage] = useState<string | null>(null);

    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const matchesSearch = !searchTerm || 
                p.orNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.amount.toString().includes(searchTerm) || 
                p.monthCovered.toLowerCase().includes(searchTerm.toLowerCase());
                
            let matchesDateFrom = true;
            if (filterDateFrom) {
                const pDate = new Date(p.date);
                const fromDate = new Date(filterDateFrom);
                if (!isNaN(pDate.getTime()) && !isNaN(fromDate.getTime())) {
                    matchesDateFrom = pDate >= fromDate;
                }
            }

            let matchesDateTo = true;
            if (filterDateTo) {
                const pDate = new Date(p.date);
                // Set to end of day to include the whole day
                const toDate = new Date(filterDateTo);
                toDate.setHours(23, 59, 59, 999);
                if (!isNaN(pDate.getTime()) && !isNaN(toDate.getTime())) {
                    matchesDateTo = pDate <= toDate;
                }
            }
            
            return matchesSearch && matchesDateFrom && matchesDateTo;
        });
    }, [payments, searchTerm, filterDateFrom, filterDateTo]);

    const [copiedLink, setCopiedLink] = useState(false);

    const handleCopyPortalLink = () => {
        if (!id) return;
        const b64Id = btoa(id);
        const link = `${window.location.origin}/portal/${b64Id}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handlePrint = () => {
        try {
            if (window.self !== window.top) {
                setPrintMessage("Printing is restricted in this preview. Please click the 'Open in New Tab' icon at the top right of the preview window to enable printing.");
                setTimeout(() => setPrintMessage(null), 8000);
            } else {
                window.print();
            }
        } catch (e) {
            window.print();
        }
    };

    const fetchData = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const headers = {
                'Authorization': `Bearer ${token}`,
                ...(accessToken ? { 'X-Google-Access-Token': accessToken } : {})
            };

            let ledgerRes, homeownersRes;
            try {
                [ledgerRes, homeownersRes] = await Promise.all([
                    fetch(`/api/ledgers/${id}`, { headers }),
                    fetch(`/api/homeowners`, { headers })
                ]);
            } catch (networkError) {
                // Handle offline fetch crash
                throw new Error('OFFLINE_FETCH');
            }

            if (!ledgerRes.ok) {
                const errBody = await ledgerRes.text();
                throw new Error(`Failed to fetch ledger (${ledgerRes.status}): ${errBody}`);
            }
            
            let paymentsData = await ledgerRes.json();
            
            // Apply any offline queued payments for this user
            const queue = JSON.parse(localStorage.getItem('offline_payment_queue') || '[]');
            const userOfflinePayments = queue.filter((p: any) => p.homeownerId === id);
            if (userOfflinePayments.length > 0) {
                paymentsData = [...paymentsData, ...userOfflinePayments];
            }
            
            setPayments(paymentsData);
            localStorage.setItem(`cached_ledger_${id}`, JSON.stringify(paymentsData));

            if (homeownersRes.ok) {
                const homeownersData = await homeownersRes.json();
                const matched = homeownersData.find((h: any) => h.id === id);
                if (matched) {
                    setHomeowner(matched);
                    localStorage.setItem(`cached_homeowner_${id}`, JSON.stringify(matched));
                }
            }
        } catch (err: any) {
            const cachedLedger = localStorage.getItem(`cached_ledger_${id}`);
            const cachedOwner = localStorage.getItem(`cached_homeowner_${id}`);
            
            if (err.message === 'OFFLINE_FETCH' || err.message.includes('fetch') || err.message.includes('offline') || err.message.includes('Network') || err.name === 'TypeError') {
                if (cachedLedger) {
                    let parsedLedger = JSON.parse(cachedLedger);
                    const queue = JSON.parse(localStorage.getItem('offline_payment_queue') || '[]');
                    const userOfflinePayments = queue.filter((p: any) => p.homeownerId === id);
                    
                    // Deduplicate against already cached items just in case
                    const offlineIds = new Set(userOfflinePayments.map((p: any) => p.id));
                    parsedLedger = parsedLedger.filter((p: any) => !offlineIds.has(p.id));
                    
                    setPayments([...parsedLedger, ...userOfflinePayments]);
                }
                if (cachedOwner) setHomeowner(JSON.parse(cachedOwner));
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id, user, accessToken]);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            setIsAddingPayment(true);
            const token = await user.getIdToken();
            
            let response;
            let isOfflineError = false;
            try {
                response = await fetch(`/api/ledgers/${id}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: Number(newPayment.amount),
                        orNumber: newPayment.orNumber,
                        monthCovered: newPayment.monthCovered,
                        date: newPayment.date
                    })
                });
            } catch (networkError) {
                isOfflineError = true;
            }
            
            if (isOfflineError || (response && !response.ok && response.status === 502)) {
                // Queue offline payment
                const queue = JSON.parse(localStorage.getItem('offline_payment_queue') || '[]');
                const offlinePayment = {
                    id: `offline-${Date.now()}`,
                    homeownerId: id || '',
                    amount: Number(newPayment.amount),
                    orNumber: newPayment.orNumber + ' (Offline)',
                    monthCovered: newPayment.monthCovered,
                    date: newPayment.date
                };
                queue.push(offlinePayment);
                localStorage.setItem('offline_payment_queue', JSON.stringify(queue));
                setPayments([...payments, offlinePayment]);
            } else if (response && !response.ok) {
                const errBody = await response.text();
                throw new Error(`Failed to log payment: ${errBody}`);
            } else {
                await fetchData();
            }
            
            setIsAddPaymentModalOpen(false);
            setNewPayment({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', orNumber: '', monthCovered: '' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAddingPayment(false);
        }
    };

    const isCollector = profile?.role === 'Collector';
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const filteredTotalPaid = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-5xl mx-auto w-full"
        >
            <div className={isSOAModalOpen ? "print:hidden" : ""}>
            {(isOffline || errorDetails?.toLowerCase().includes('offline') || error?.toLowerCase().includes('offline') || error?.toLowerCase().includes('failed to fetch')) && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-full">
                            <WifiOff className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <span className="font-semibold block sm:inline text-orange-900">Offline Mode Active.</span>
                            <span className="sm:ml-2 text-orange-700">Could not reach Cloud Firestore. The client is operating in offline mode.</span>
                        </div>
                    </div>
                </motion.div>
            )}

            {!accessToken && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between"
                >
                    <div>
                        <span className="font-semibold block sm:inline">Connect Google Account.</span>
                        <span className="sm:ml-2">Please connect your Google account to read the ledger sheet.</span>
                    </div>
                    <Button onClick={() => user && signInWithGoogle?.()} variant="outline" size="sm" className="bg-white hover:bg-slate-50 transition-colors">
                        Connect Account
                    </Button>
                </motion.div>
            )}
            
            <button 
                onClick={() => navigate(-1)}
                className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 font-medium group"
            >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Directory
            </button>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div>
                    {homeowner ? (
                        <>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex gap-3">
                                <span className={`uppercase ${homeowner.residentStatus === 'Tenant' ? 'text-purple-600' : 'text-amber-600'}`}>{homeowner.residentStatus}</span> - {homeowner.name}
                            </h1>
                            <div className="flex flex-col gap-1 mt-2">
                                <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                                    <MapPin className="w-4 h-4" />
                                    Block {homeowner.block}, Lot {homeowner.lot} - Breezewoods 1
                                </p>
                                <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                                    <span className="w-4 inline-block text-center rounded bg-slate-200">#</span>
                                    ID: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">BW1-B{homeowner.block}L{homeowner.lot}</span>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                                Homeowner Profile
                            </h1>
                            <p className="text-slate-500 mt-1 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                ID: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{id}</span>
                            </p>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={handleCopyPortalLink} className="shadow-sm hover:bg-slate-50 transition-colors hover:border-slate-300 relative">
                        {copiedLink ? (
                            <>
                                <Check className="w-4 h-4 mr-2 text-emerald-600" />
                                <span className="text-emerald-700">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4 mr-2 text-slate-500" />
                                Copy Portal Link
                            </>
                        )}
                    </Button>
                    {/* Only show 'Log Payment' for Admin or Collector */}
                    {(profile?.role === 'Admin' || profile?.role === 'Collector') && (
                        <Button 
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                            onClick={() => setIsAddPaymentModalOpen(true)}
                        >
                            <Receipt className="w-4 h-4 mr-2" />
                            Log New Payment
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setIsSOAModalOpen(true)} className="shadow-sm hover:bg-slate-50 transition-colors hover:border-slate-300">
                        <FileText className="w-4 h-4 mr-2 text-blue-600" />
                        Generate SOA
                    </Button>
                </div>
            </div>

            {printMessage && (
                <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Info className="w-5 h-5 text-blue-500" />
                        <span>{printMessage}</span>
                    </div>
                    <button onClick={() => setPrintMessage(null)} className="text-blue-500 hover:text-blue-700 font-bold px-2">&times;</button>
                </div>
            )}

            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center"
                    >
                        {error}
                        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold px-2">&times;</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
               <motion.div whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
                   <Card className="p-6 bg-slate-900 text-white shadow-lg overflow-hidden relative h-full flex flex-col justify-center">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                        <p className="text-slate-400 text-sm font-medium mb-1 relative z-10">Total Payments Logged</p>
                        <p className="text-3xl font-bold tracking-tight relative z-10">P {totalPaid.toLocaleString()}</p>
                        <p className="text-xs text-slate-400 mt-4 flex items-center gap-1 relative z-10">
                            <Calendar className="w-3 h-3" />
                            As of {format(new Date(), 'MMM d, yyyy')}
                        </p>
                   </Card>
               </motion.div>
                
               <Card className="md:col-span-2 p-6 bg-white shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                        {[ '2025', '2026' ].map(year => (
                            <div key={year} className="flex-1">
                                <h3 className="text-xs font-semibold text-blue-600 mb-4 text-center uppercase tracking-widest">Year {year}</h3>
                                <div className="divide-y divide-slate-100">
                                    {[
                                        { label: 'January', value: '01' },
                                        { label: 'February', value: '02' },
                                        { label: 'March', value: '03' },
                                        { label: 'April', value: '04' },
                                        { label: 'May', value: '05' },
                                        { label: 'June', value: '06' },
                                        { label: 'July', value: '07' },
                                        { label: 'August', value: '08' },
                                        { label: 'September', value: '09' },
                                        { label: 'October', value: '10' },
                                        { label: 'November', value: '11' },
                                        { label: 'December', value: '12' },
                                    ].map(month => {
                                        const monthKey = `${year}-${month.value}`;
                                        const payment = payments.find(p => p.monthCovered === monthKey);
                                        
                                        return (
                                            <div key={month.label} className="py-2.5 flex items-center justify-between text-sm group cursor-default">
                                                <span className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{month.label}</span>
                                                {payment ? (
                                                    <div className="text-right flex items-center gap-3">
                                                        <div className="flex flex-col items-end hidden sm:flex">
                                                            <span className="text-[10px] text-slate-400 font-mono leading-tight">OR: {payment.orNumber}</span>
                                                            <span className="text-[10px] text-slate-400 leading-tight block truncate mx-w-[80px]">{safeFormatDate(payment.date, 'MMM d, yy')}</span>
                                                        </div>
                                                        <span className="font-bold text-[10px] tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-[45px] text-center">Paid</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-[10px] tracking-wider uppercase text-slate-400 w-[45px] text-center">Unpaid</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
               </Card>
            </div>

            <Card className="bg-white shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
                        <Badge variant="outline" className="text-slate-500 bg-white shadow-sm">{filteredPayments.length} Records</Badge>
                    </div>
                </div>

                {payments.length > 0 && (
                    <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-1/3 relative">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="Amount, OR number, or month..." 
                                    className="pl-9 bg-slate-50/50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">From Date</label>
                            <Input 
                                type="date" 
                                className="bg-slate-50/50"
                                value={filterDateFrom}
                                onChange={(e) => setFilterDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">To Date</label>
                            <Input 
                                type="date" 
                                className="bg-slate-50/50"
                                value={filterDateTo}
                                onChange={(e) => setFilterDateTo(e.target.value)}
                            />
                        </div>
                        {(searchTerm || filterDateFrom || filterDateTo) && (
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterDateFrom('');
                                    setFilterDateTo('');
                                }}
                                className="text-slate-500 hover:text-slate-900 px-3 w-full md:w-auto"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">OR Number</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider">Month Covered</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p>Loading ledger records...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Receipt className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p>No payments recorded yet.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Filter className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p>No payments match the applied filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence>
                                    {filteredPayments.map((p, i) => (
                                        <motion.tr 
                                            key={p.id}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-slate-50 transition-colors group cursor-default"
                                        >
                                            <td className="px-6 py-4 text-slate-900 group-hover:text-blue-700 transition-colors">{safeFormatDate(p.date, 'MMM d, yyyy')}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-blue-700 font-mono">P {p.amount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{p.orNumber}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/50">{p.monthCovered}</Badge>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <AnimatePresence>
                {isAddPaymentModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50"
                        >
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-xl font-semibold text-slate-900">Log New Payment</h2>
                                <p className="text-sm text-slate-500 mt-1">Record a payment for {id}.</p>
                            </div>
                            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
                                        <Input 
                                            type="date"
                                            required
                                            value={newPayment.date}
                                            onChange={e => setNewPayment({...newPayment, date: e.target.value})}
                                            className="focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (PHP)</label>
                                        <Input 
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            placeholder="e.g. 500"
                                            value={newPayment.amount}
                                            onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                                            className="focus:ring-2 focus:ring-blue-100 transition-all font-medium font-mono"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">OR Number</label>
                                    <Input 
                                        required
                                        placeholder="e.g. 123456"
                                        value={newPayment.orNumber}
                                        onChange={e => setNewPayment({...newPayment, orNumber: e.target.value})}
                                        className="focus:ring-2 focus:ring-blue-100 transition-all font-medium font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Month Covered</label>
                                    <Input 
                                        required
                                        placeholder="e.g. Jan 2026"
                                        value={newPayment.monthCovered}
                                        onChange={e => setNewPayment({...newPayment, monthCovered: e.target.value})}
                                        className="focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                                    />
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6 -mx-6 px-6 -mb-6 pb-6 pt-6 bg-slate-50/50">
                                    <Button type="button" variant="ghost" onClick={() => setIsAddPaymentModalOpen(false)} className="hover:bg-slate-100">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isAddingPayment} className="min-w-[120px] relative overflow-hidden">
                                        <AnimatePresence mode="wait">
                                            <motion.span 
                                                key={isAddingPayment ? 'adding' : 'idle'}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="flex items-center justify-center gap-2 shadow"
                                            >
                                                {isAddingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {isAddingPayment ? 'Saving...' : 'Save Payment'}
                                            </motion.span>
                                        </AnimatePresence>
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </div>

            <SOAGeneratorModal
                isOpen={isSOAModalOpen}
                onClose={() => setIsSOAModalOpen(false)}
                homeownerId={id || ''}
                homeowner={homeowner}
                payments={payments}
                profile={profile}
            />
        </motion.div>
    );
};
