import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Layout, type PageKey } from '@/components/Layout';
import { AdminLayout, type AdminPageKey } from '@/components/AdminLayout';
import { AuthPage } from '@/pages/Auth';
import { DashboardPage } from '@/pages/Dashboard';
import { SubscriptionPage } from '@/pages/Subscription';
import { PaymentsPage } from '@/pages/Payments';
import { PaymentMethodsPage } from '@/pages/PaymentMethods';
import { BackupsPage } from '@/pages/Backups';
import { AdminDashboardPage } from '@/pages/AdminDashboard';
import { AdminClientDetailPage } from '@/pages/AdminClientDetail';
import { SetupPage } from '@/pages/Setup';
import { LandingPage } from '@/pages/Landing';
import { Spinner } from '@/components/ui';

function getRouteFromHash(): { page: PageKey; auth: 'login' | 'signup' | null; isSetup: boolean; isLanding: boolean } {
  let hash = window.location.hash.slice(1);
   if (hash.startsWith('/')) hash = hash.slice(1); 
  if (hash === '') return { page: 'dashboard', auth: null, isSetup: false, isLanding: true };
  if (hash === 'login') return { page: 'dashboard', auth: 'login', isSetup: false, isLanding: false };
  if (hash === 'signup') return { page: 'dashboard', auth: 'signup', isSetup: false, isLanding: false };
  if (hash.startsWith('setup')) return { page: 'dashboard', auth: null, isSetup: true, isLanding: false };
  const validPages: PageKey[] = [
    'dashboard',
    'subscription',
    'payments',
    'payment-methods',
    'backups',
  ];
  if (validPages.includes(hash as PageKey)) {
    return { page: hash as PageKey, auth: null, isSetup: false, isLanding: false };
  }
  return { page: 'dashboard', auth: null, isSetup: false, isLanding: true };
}

function AppContent() {
  const { session, loading, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [adminPage, setAdminPage] = useState<AdminPageKey>('admin-dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [isLanding, setIsLanding] = useState(false);

  useEffect(() => {
    const route = getRouteFromHash();
    setCurrentPage(route.page);
    setAuthMode(route.auth);
    setIsSetup(route.isSetup);
    setIsLanding(route.isLanding);

    const handleHashChange = () => {
      const r = getRouteFromHash();
      setCurrentPage(r.page);
      setAuthMode(r.auth);
      setIsSetup(r.isSetup);
      setIsLanding(r.isLanding);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (key: PageKey) => {
    window.location.hash = key;
    setCurrentPage(key);
  };

  if (loading) {
    return <Spinner className="min-h-screen" />;
  }

  // Setup page — accessible without auth (invite link flow)
  if (isSetup) {
    return <SetupPage />;
  }

  if (!session) {
    if (isLanding) return <LandingPage />;
    const mode = authMode === 'signup' ? 'signup' : 'login';
    return <AuthPage mode={mode} />;
  }

  // Admin view
  if (isAdmin) {
    const backToList = () => {
      setSelectedClientId(null);
      setAdminPage('admin-dashboard');
    };

    const selectClient = (id: string) => {
      setSelectedClientId(id);
      setAdminPage('admin-client-detail');
    };

    return (
      <AdminLayout current={adminPage} onBackToList={backToList}>
        {adminPage === 'admin-dashboard' && (
          <AdminDashboardPage onSelectClient={selectClient} />
        )}
        {adminPage === 'admin-client-detail' && selectedClientId && (
          <AdminClientDetailPage userId={selectedClientId} />
        )}
      </AdminLayout>
    );
  }

  // Client view
  return (
    <Layout current={currentPage} onNavigate={navigate}>
      {currentPage === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {currentPage === 'subscription' && <SubscriptionPage />}
      {currentPage === 'payments' && <PaymentsPage />}
      {currentPage === 'payment-methods' && <PaymentMethodsPage />}
      {currentPage === 'backups' && <BackupsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
