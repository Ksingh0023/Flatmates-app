import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage      from './pages/LoginPage';
import DashboardPage  from './pages/DashboardPage';
import GroupsPage     from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ExpensesPage   from './pages/ExpensesPage';
import SettlementsPage from './pages/SettlementsPage';
import ImportPage     from './pages/ImportPage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />

      <Route path="/" element={
        <PrivateRoute>
          <AppLayout><DashboardPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/groups" element={
        <PrivateRoute>
          <AppLayout><GroupsPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/groups/:id" element={
        <PrivateRoute>
          <AppLayout><GroupDetailPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/expenses" element={
        <PrivateRoute>
          <AppLayout><ExpensesPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/settlements" element={
        <PrivateRoute>
          <AppLayout><SettlementsPage /></AppLayout>
        </PrivateRoute>
      } />
      <Route path="/import" element={
        <PrivateRoute>
          <AppLayout><ImportPage /></AppLayout>
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              color: '#f0f0f8',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#000' } },
            error:   { iconTheme: { primary: '#f87171', secondary: '#000' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
