import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, adminsApi } from '../../api/admins';

export const AdminSettings = () => {
  const queryClient = useQueryClient();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [pwMsg, setPwMsg] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  // UI values in minutes; convert to seconds for the backend
  const [offerTimeoutMins, setOfferTimeoutMins] = useState<number | null>(null);
  const [restrictMins, setRestrictMins] = useState<number | null>(null);

  const updateSettingsMutation = useMutation({
    mutationFn: () => settingsApi.update({
      offer_open_timeout_seconds: offerTimeoutMins !== null ? offerTimeoutMins * 60 : undefined,
      driver_restriction_seconds: restrictMins !== null ? restrictMins * 60 : undefined,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const changePwMutation = useMutation({
    mutationFn: () => adminsApi.changeMyPassword(pwForm.current_password, pwForm.new_password),
    onSuccess: (data: any) => { setPwMsg(data.message || 'تم تغيير كلمة المرور بنجاح.'); setPwForm({ current_password: '', new_password: '' }); },
    onError: () => setPwMsg('فشل تغيير كلمة المرور.'),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800">الإعدادات</h2>

      {/* System Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-800">إعدادات النظام</h3>
        {settings && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مهلة فتح العرض
                <span className="mr-2 text-gray-400 font-normal">الحالي: {Math.round(settings.offer_open_timeout_seconds / 60)} دقيقة</span>
              </label>
              <div className="relative">
                <input
                  type="number" min="1" max="60"
                  defaultValue={Math.round(settings.offer_open_timeout_seconds / 60)}
                  onChange={e => setOfferTimeoutMins(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pl-16 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">دقيقة</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                مدة إيقاف المندوب
                <span className="mr-2 text-gray-400 font-normal">الحالي: {Math.round(settings.driver_restriction_seconds / 60)} دقيقة</span>
              </label>
              <div className="relative">
                <input
                  type="number" min="1" max="10080"
                  defaultValue={Math.round(settings.driver_restriction_seconds / 60)}
                  onChange={e => setRestrictMins(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pl-16 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">دقيقة</span>
              </div>
            </div>
            <button
              onClick={() => updateSettingsMutation.mutate()}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {updateSettingsMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
            </button>
            {updateSettingsMutation.isSuccess && <p className="text-sm text-green-600">تم حفظ الإعدادات بنجاح!</p>}
          </>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-800">تغيير كلمة مروري</h3>
        <form onSubmit={e => { e.preventDefault(); setPwMsg(''); changePwMutation.mutate(); }} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الحالية</label>
            <input
              type="password" required
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <input
              type="password" required minLength={8}
              value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {pwMsg && <p className={`text-sm p-2 rounded-lg ${pwMsg.includes('Failed') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{pwMsg}</p>}
          <button
            type="submit"
            disabled={changePwMutation.isPending}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
              {changePwMutation.isPending ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
};
