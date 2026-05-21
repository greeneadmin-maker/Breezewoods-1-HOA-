import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { motion } from 'motion/react';
import { ShieldCheck, UserCog, KeySquare } from 'lucide-react';
import { UserProfile } from '../contexts/AuthContext';

interface UserDoc extends UserProfile {
    id: string;
}

export const UserManagement = () => {
    const { profile, accessToken } = useAuth();
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsersAndSettings = async () => {
            if (profile?.role !== 'Admin') return;
            try {
                const snapshot = await getDocs(collection(db, 'users'));
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc));
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsersAndSettings();
    }, [profile, accessToken]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await updateDoc(doc(db, 'users', userId), { 
                role: newRole,
                updatedAt: serverTimestamp()
            });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
        } catch (error) {
            console.error("Error updating role", error);
            alert("Failed to update role. You might lack permissions.");
        }
    };

    if (profile?.role !== 'Admin') {
         return null;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
             <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-blue-600" />
                    Admin Settings & Users
                </h1>
                <p className="text-slate-500 mt-2">Manage settings, staff roles, and approve pending accounts.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <UserCog className="w-5 h-5 text-slate-500" />
                        System Access
                    </h2>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Email</th>
                                <th className="px-6 py-4 font-medium">Status / Role</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : (
                                users.map((u, i) => (
                                     <motion.tr 
                                        key={u.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="hover:bg-slate-50/50"
                                     >
                                         <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                         <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                         <td className="px-6 py-4">
                                            <Badge variant={u.role === 'Pending' ? 'destructive' : 'secondary'} className={
                                                u.role === 'Pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                                u.role === 'Admin' ? 'bg-violet-100 text-violet-700 hover:bg-violet-100' :
                                                'bg-blue-50 text-blue-700 hover:bg-blue-50'
                                            }>
                                                {u.role === 'Pending' ? 'Pending Approval' : u.role}
                                            </Badge>
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end pr-2">
                                                <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id as string, val as string)}>
                                                    <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                                                        <SelectValue placeholder="Assign Role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pending">Pending</SelectItem>
                                                        <SelectItem value="Admin">Admin</SelectItem>
                                                        <SelectItem value="President">President</SelectItem>
                                                        <SelectItem value="Collector">Collector</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                         </td>
                                     </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};
