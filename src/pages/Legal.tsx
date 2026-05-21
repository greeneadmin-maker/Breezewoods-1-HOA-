import React from 'react';
import { motion } from 'motion/react';
import { Shield, FileText, Lock } from 'lucide-react';
import { Card } from '../components/ui/card';

export const Legal = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-4xl mx-auto w-full space-y-8"
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Legal & Security</h1>
                <p className="text-slate-500 mt-1">Terms of Service, Data Privacy, and Security Information</p>
            </div>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-slate-900">Security & Encryption</h2>
                </div>
                <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                    <p><strong>End-to-End Protection:</strong> This application utilizes bank-grade TLS/SSL encryption for all data transmitted between the client interface and our secure backend servers. Scammers and code breakers cannot intercept or decipher your network traffic.</p>
                    <p><strong>Authentication:</strong> We use Firebase Authentication which implements industry-standard protocols (OAuth 2.0 and OpenID Connect). Tokens are verified server-side using asymmetric cryptography ensuring mathematically secure sessions.</p>
                    <p><strong>Rate Limiting & Brute Force Protection:</strong> Our backend APIs are equipped with active Rate Limiting algorithms to block automated attacks, spam, and brute-force cracking attempts dynamically.</p>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-slate-900">Data Privacy Policy</h2>
                </div>
                <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                    <p>We are committed to protecting the privacy of our homeowners and residents in Breezewoods 1 HOA in compliance with relevant Data Privacy laws.</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Data Collection:</strong> We only collect necessary personal data including names, block/lot numbers, contact details, and payment histories solely for managing HOA ledgers.</li>
                        <li><strong>Data Usage:</strong> Your data is used exclusively for internal HOA operations, billing, and announcements. It is completely isolated and is never sold or shared with external marketing agencies.</li>
                        <li><strong>Data Retention:</strong> Records are kept securely within enterprise-grade infrastructure and are accessible ONLY to role-authorized personnel (Admins, Presidents, and Collectors).</li>
                        <li><strong>Your Rights:</strong> You have the right to access, correct, or request deletion of your data by contacting the HOA Administration directly.</li>
                    </ul>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6 text-emerald-600" />
                    <h2 className="text-xl font-bold text-slate-900">Terms and Conditions</h2>
                </div>
                <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                    <p>By using the Breezewoods 1 HOA Ledger System, you agree to the following terms:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li><strong>Authorized Access:</strong> Only registered and administration-approved users may access this system. Sharing of credentials or exposing the dashboard to unauthorized persons is strictly prohibited.</li>
                        <li><strong>Accuracy of Information:</strong> Collectors and Admins must ensure that all payments and manual entries recorded are accurate, truthful, and correspond directly to physical official receipts.</li>
                        <li><strong>System Integrity:</strong> Any attempt to compromise, reverse-engineer, exploit, or disrupt the system's operations will be logged and may result in immediate termination of access and civil/criminal legal action.</li>
                        <li><strong>Liability:</strong> The Developer and the HOA Board provide this secure platform "as is" and shall not be liable for incidental damages arising from local network system downtimes or user-inflicted data inaccuracies.</li>
                    </ol>
                </div>
            </Card>
        </motion.div>
    );
};
