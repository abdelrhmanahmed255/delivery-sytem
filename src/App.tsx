import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthGuard } from './components/AuthGuard';
import { AdminLogin } from './pages/AdminLogin';
import { DriverLogin } from './pages/DriverLogin';
import { DriverRegister } from './pages/DriverRegister';
import { RegisterSuccess } from './pages/RegisterSuccess';
import { AdminLayout } from './components/AdminLayout';
import { DriverLayout } from './components/DriverLayout';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminDrivers } from './pages/admin/AdminDrivers';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminActivity } from './pages/admin/AdminActivity';
import { AdminSettings } from './pages/admin/AdminSettings';

import { DriverHome } from './pages/driver/DriverHome';
import { DriverActiveOrders } from './pages/driver/DriverActiveOrders';
import { DriverProfile } from './pages/driver/DriverProfile';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<DriverLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/register" element={<DriverRegister />} />
          <Route path="/register/success" element={<RegisterSuccess />} />

          <Route path="/admin" element={<AuthGuard allowedRole="admin" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="drivers" element={<AdminDrivers />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route path="/driver" element={<AuthGuard allowedRole="driver" />}>
            <Route element={<DriverLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<DriverHome />} />
              <Route path="active" element={<DriverActiveOrders />} />
              <Route path="profile" element={<DriverProfile />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
