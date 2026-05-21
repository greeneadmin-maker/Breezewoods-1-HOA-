import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Calculator, FileText, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { format, differenceInMonths, startOfMonth, endOfMonth } from 'date-fns';

export function SOAGeneratorModal({ 
    isOpen, 
    onClose, 
    homeownerId, 
    homeowner,
    payments, 
    profile 
}: { 
    isOpen: boolean; 
    onClose: () => void;
    homeownerId: string;
    homeowner: any;
    payments: any[];
    profile: any;
}) {
    const [dateFrom, setDateFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')); // default start of year
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [monthlyDues, setMonthlyDues] = useState('150');
    const [arrears, setArrears] = useState('0');

    const [printMessage, setPrintMessage] = useState<string | null>(null);

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

    // Calculate SOA specifics
    const { filteredPayments, totalPaid, totalExpected, outstandingBalance, monthsCount } = useMemo(() => {
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);

        const filtered = payments.filter((p: any) => {
            const pDate = new Date(p.date);
            return pDate >= fromDate && pDate <= toDate;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const paid = filtered.reduce((sum, p) => sum + Number(p.amount), 0);
        
        let mCount = 0;
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
            mCount = differenceInMonths(endOfMonth(toDate), startOfMonth(fromDate)) + 1;
            if (mCount < 0) mCount = 0;
        }

        const dues = Number(monthlyDues) || 0;
        const previousArrears = Number(arrears) || 0;
        const expected = (mCount * dues) + previousArrears;
        const outstanding = expected - paid;

        return {
            filteredPayments: filtered,
            totalPaid: paid,
            totalExpected: expected,
            outstandingBalance: outstanding,
            monthsCount: mCount
        };
    }, [payments, dateFrom, dateTo, monthlyDues, arrears]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex print:static print:block">
                {/* Backdrop - hidden when printing */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden"
                    onClick={onClose}
                />
                
                {/* Modal Container - static on print */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-4 md:inset-10 bg-slate-100 rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden print:static print:inset-0 print:m-0 print:rounded-none print:shadow-none print:bg-white"
                >
                    {/* Sidebar Configuration - hidden when printing */}
                    <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col print:hidden z-10 shrink-0">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 relative z-20">
                            <div>
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    SOA Generator
                                </h3>
                                <p className="text-xs text-slate-500">Configure Statement</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <div className="p-5 flex-1 overflow-y-auto space-y-5">
                            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <Calendar className="w-3.5 h-3.5" /> Date Range
                                </h4>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="h-8 text-sm bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="h-8 text-sm bg-white"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 italic mt-1">
                                    Spans {monthsCount} month(s).
                                </p>
                            </div>

                            <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                                <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <Calculator className="w-3.5 h-3.5" /> Billing Variables
                                </h4>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Dues (PHP)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={monthlyDues}
                                        onChange={(e) => setMonthlyDues(e.target.value)}
                                        className="h-8 text-sm bg-white border-blue-200 focus:border-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Previous Arrears/Balance (PHP)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={arrears}
                                        onChange={(e) => setArrears(e.target.value)}
                                        className="h-8 text-sm bg-white border-blue-200 focus:border-blue-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative z-20">
                            {printMessage && (
                                <div className="mb-3 p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200 shadow-sm leading-relaxed text-center">
                                    {printMessage}
                                </div>
                            )}
                            <Button 
                                onClick={handlePrint} 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all shadow-blue-600/20"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                Generate / Print PDF
                            </Button>
                        </div>
                    </div>

                    {/* Preview Document */}
                    <div className="flex-1 overflow-y-auto bg-slate-200/50 p-4 md:p-8 print:p-0 print:bg-white print:overflow-visible relative">
                        <div className="max-w-[800px] mx-auto bg-white shadow-xl min-h-[1056px] print:shadow-none print:min-h-0 print:w-full">
                            <div className="p-10 font-sans text-slate-900">
                                {/* Header */}
                                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-10">
                                    <div>
                                        <h1 className="text-3xl font-bold tracking-tight uppercase text-slate-900">Breezewoods 1</h1>
                                        <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-1">Homeowner Association Inc.</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-2xl font-light text-slate-600 uppercase tracking-widest text-blue-600">Generated SOA</h2>
                                        <p className="text-slate-400 text-sm mt-1">{format(new Date(), 'MMMM d, yyyy')}</p>
                                    </div>
                                </div>

                                {/* Meta Information */}
                                <div className="flex justify-between mb-10">
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Billed To</p>
                                        <h3 className="text-lg font-semibold text-slate-900 bg-blue-50/50 inline-block px-2 py-0.5 rounded -ml-2">{homeowner ? homeowner.name : `Homeowner ${homeownerId}`}</h3>
                                        <p className="text-slate-600 mt-1 font-medium">ID: {homeowner ? `BW1-B${homeowner.block}L${homeowner.lot}` : homeownerId}</p>
                                    </div>
                                    <div className="flex-1 text-right">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Period</p>
                                        <p className="text-slate-800 text-sm font-medium">
                                            {dateFrom ? format(new Date(dateFrom), 'MMM d, yyyy') : '-'}  to  {dateTo ? format(new Date(dateTo), 'MMM d, yyyy') : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Financial Summary */}
                                <div className="grid grid-cols-3 gap-6 mb-10">
                                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-center">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Previous Balance</p>
                                        <p className="text-xl font-mono text-slate-700">P {(Number(arrears) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-center">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Period Dues</p>
                                        <p className="text-xl font-mono text-slate-700">P {((monthsCount * Number(monthlyDues)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-blue-50 p-4 border border-blue-200 rounded-lg text-center">
                                        <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-1">Total Expected</p>
                                        <p className="text-xl font-mono font-bold text-blue-700">P {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Payments Applied</h4>
                                <div className="rounded-lg border border-slate-200 overflow-hidden mb-8">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-100 text-slate-600 uppercase text-xs tracking-wider font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3">Date</th>
                                                <th className="px-5 py-3">Month Covered</th>
                                                <th className="px-5 py-3">Ref/OR No.</th>
                                                <th className="px-5 py-3 text-right">Amount Paid</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredPayments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 italic bg-slate-50/50">No payments found in this period.</td>
                                                </tr>
                                            ) : (
                                                filteredPayments.map((p: any, i: number) => (
                                                    <tr key={p.id || i}>
                                                        <td className="px-5 py-3 text-slate-900">{format(new Date(p.date), 'MMM d, yyyy')}</td>
                                                        <td className="px-5 py-3 text-slate-700">{p.monthCovered}</td>
                                                        <td className="px-5 py-3 text-slate-500 font-mono text-xs">{p.orNumber}</td>
                                                        <td className="px-5 py-3 text-right font-mono text-slate-900 font-medium">P {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                            <tr>
                                                <th className="px-5 py-4 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs" colSpan={3}>Subtotal Received</th>
                                                <th className="px-5 py-4 text-right font-mono font-bold text-slate-900">P {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                                            </tr>
                                            <tr className={outstandingBalance > 0 ? "bg-red-50/50 border-t border-slate-200" : "bg-emerald-50/50 border-t border-slate-200"}>
                                                <th className={`px-5 py-5 text-right font-bold uppercase tracking-wider text-sm ${outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`} colSpan={3}>
                                                    {outstandingBalance > 0 ? 'Remaining Outstanding Balance' : 'Overpaid / Advance credit'}
                                                </th>
                                                <th className={`px-5 py-5 text-right font-mono font-bold text-lg ${outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                                                    P {Math.abs(outstandingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                <p className="text-xs text-slate-500 text-center italic mt-10">This document reflects transactions logged in the system. Check official receipts for original evidence of payment.</p>

                                {/* Signatures */}
                                <div className="mt-8 pt-8 grid grid-cols-2 gap-12 text-sm">
                                    <div className="border-t border-slate-300 pt-3">
                                        <p className="font-semibold text-slate-900">{profile?.name || 'System Generated'}</p>
                                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-wider">{profile?.role || 'Authorized Personnel'}</p>
                                    </div>
                                    <div className="text-right flex flex-col justify-end">
                                        <div className="h-6 w-32 border-b border-slate-300 self-end mb-2"></div>
                                        <p className="text-slate-500 text-xs uppercase tracking-wider">Homeowner's Signature</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
