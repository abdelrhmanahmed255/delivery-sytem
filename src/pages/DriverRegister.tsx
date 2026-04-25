import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export const DriverRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    legal_arabic_name: '',
    national_id_number: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    vehicle_type: 'Motorcycle',
    vehicle_plate: '',
  });

  const setField = (key: string, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    if (form.password.length < 8) {
      setError('يجب أن تكون كلمة المرور 8 أحرف على الأقل.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.driverRegister({
        full_name: form.full_name,
        legal_arabic_name: form.legal_arabic_name,
        national_id_number: form.national_id_number,
        email: form.email,
        phone: form.phone,
        password: form.password,
        vehicle_type: form.vehicle_type || undefined,
        vehicle_plate: form.vehicle_plate || undefined,
      });
      navigate('/register/success');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('فشل التسجيل، يرجى التحقق من البيانات المدخلة.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-6 text-white">
          <h1 className="text-2xl font-bold">انضم كمندوب توصيل</h1>
          <p className="text-blue-200 text-sm mt-1">أنشئ حسابك وابدأ في التوصيل</p>
          {/* Steps */}
          <div className="flex items-center gap-3 mt-4">
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${step >= 1 ? 'text-white' : 'text-blue-300'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'}`}>١</span>
              البيانات الشخصية
            </div>
            <div className="flex-1 h-px bg-blue-400" />
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${step >= 2 ? 'text-white' : 'text-blue-300'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'}`}>٢</span>
              بيانات المركبة
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم الكامل (إنجليزي) *</label>
                  <input
                    type="text" required
                    value={form.full_name}
                    onChange={e => setField('full_name', e.target.value)}
                    placeholder="الاسم بالإنجليزية"
                    dir="ltr"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم الكامل (عربي) *</label>
                  <input
                    type="text" required dir="rtl"
                    value={form.legal_arabic_name}
                    onChange={e => setField('legal_arabic_name', e.target.value)}
                    placeholder="الاسم القانوني كما في البطاقة"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رقم البطاقة الوطنية *</label>
                  <input
                    type="text" required minLength={14} maxLength={14} pattern="\d{14}"
                    value={form.national_id_number}
                    onChange={e => setField('national_id_number', e.target.value)}
                    placeholder="١٤ رقم"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني *</label>
                  <input
                    type="email" required
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="البريد الإلكتروني"
                    dir="ltr"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الهاتف *</label>
                  <input
                    type="tel" required minLength={10}
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    placeholder="رقم الهاتف"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور *</label>
                  <input
                    type="password" required minLength={8}
                    value={form.password}
                    onChange={e => setField('password', e.target.value)}
                    placeholder="٨ أحرف على الأقل"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">تأكيد كلمة المرور *</label>
                  <input
                    type="password" required
                    value={form.confirm_password}
                    onChange={e => setField('confirm_password', e.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-base transition-colors"
              >
                التالي ←
              </button>

              <div className="text-center mt-6 pt-6 border-t border-gray-100">
                <Link to="/login" className="text-sm font-semibold text-gray-500 hover:text-gray-700">
                  لديك حساب بالفعل؟ تسجيل الدخول
                </Link>
              </div>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                <span className="text-3xl">🏍️</span>
                <div>
                  <p className="font-bold text-blue-800">نوع المركبة: دراجة نارية</p>
                  <p className="text-xs text-blue-600 mt-0.5">نوع المركبة المقبول في النظام حالياً</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">رقم لوحة المركبة</label>
                <input
                  type="text"
                  value={form.vehicle_plate}
                  onChange={e => setField('vehicle_plate', e.target.value)}
                  placeholder="مثال: أ ب ج ١٢٣٤"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  disabled={loading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition-colors disabled:opacity-60"
                >
                  العودة
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? 'جارٍ الإرسال...' : 'إرسال الطلب ✓'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
