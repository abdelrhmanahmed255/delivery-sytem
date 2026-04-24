import { Link } from 'react-router-dom';

export const RegisterSuccess = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900">تم إرسال طلبك بنجاح!</h2>
      <p className="text-gray-500">
        تم إنشاء حسابك وهو الآن في انتظار <strong>موافقة المسؤول</strong>.
        ستتمكن من تسجيل الدخول وبدء استلام الطلبات فور الموافقة على طلبك.
      </p>
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 font-medium">
        ⏳ تستغرق المراجعة عادةً من ١ إلى ٢ يوم عمل.
      </div>
      <Link
        to="/login"
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
      >
        الذهاب إلى تسجيل الدخول
      </Link>
    </div>
  </div>
);
