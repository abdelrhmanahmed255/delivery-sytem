import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginAs, setLoginAs] = useState<'admin' | 'driver'>('driver');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = loginAs === 'admin' ? '/auth/admin/login' : '/auth/driver/login';
      const { data } = await apiClient.post(endpoint, { email, password });
      
      setAuth(data.access_token, data.account_type, data.account_id);
      
      if (data.account_type === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/driver/home');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '));
      } else {
        setError('فشل تسجيل الدخول، يرجى التحقق من بياناتك.');
      }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <div className="flex justify-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">نظام التوصيل</h2>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6 shadow-inner">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginAs === 'driver' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setLoginAs('driver')}
          >
            مندوب توصيل
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginAs === 'admin' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setLoginAs('admin')}
          >
            مسؤول
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          
          {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 font-semibold rounded-lg text-white transition-colors duration-200 ${loading ? 'bg-gray-400' : loginAs === 'admin' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? 'جارٍ تسجيل الدخول...' : `تسجيل الدخول كـ${loginAs === 'driver' ? 'مندوب' : 'مسؤول'}`}
          </button>
        </form>

        {loginAs === 'driver' && (
          <p className="text-center text-sm text-gray-500 mt-5">
            مندوب جديد؟{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">
              سجّل طلبك هنا
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};
