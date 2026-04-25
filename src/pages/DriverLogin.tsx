import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export const DriverLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/auth/driver/login', { email, password });
      setAuth(data.access_token, data.account_type, data.account_id);
      navigate('/driver/home');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '));
      } else {
        setError('فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
      <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <span className="text-3xl">🏍️</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">بوابة المندوبين</h1>
          <p className="text-gray-400 text-sm mt-1">تسجيل دخول مندوب التوصيل</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
              placeholder="البريد الإلكتروني"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-100 p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-lg rounded-xl transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? 'جارٍ تسجيل الدخول...' : 'دخول'}
          </button>
        </form>

        <p className="text-center text-sm font-medium text-gray-500 mt-6 pt-6 border-t border-gray-100">
          مندوب جديد؟{' '}
          <Link to="/register" className="text-blue-600 font-bold hover:underline">
            سجّل طلبك هنا
          </Link>
        </p>

        <div className="mt-6 text-center">
          <Link
            to="/login/admin"
            className="text-xs font-semibold text-gray-300 hover:text-gray-500 transition-colors"
          >
            دخول المسؤولين
          </Link>
        </div>
      </div>
    </div>
  );
};
