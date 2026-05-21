/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { PendingApproval } from './pages/PendingApproval';
import { Directory } from './pages/Directory';
import { HomeownerProfile } from './pages/HomeownerProfile';
import { UserManagement } from './pages/UserManagement';
import { Dashboard } from './pages/Dashboard';
import { Legal } from './pages/Legal';
import { ProofApprovals } from './pages/ProofApprovals';
import { Portal } from './pages/Portal';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/portal/:id" element={<Portal />} />
          
          <Route path="/" element={<Layout />}>
            <Route index element={<Directory />} />
            <Route path="homeowner/:id" element={<HomeownerProfile />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="proofs" element={<ProofApprovals />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="legal" element={<Legal />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
