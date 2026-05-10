import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import {
  isClosedOnDate,
  sumPayouts,
  useGlobalShifts,
} from '../../api/shifts';
import { StatusBadge } from '../../components/StatusBadge';
import { formatCount, formatMoney, todayIso } from '../../utils/format';

export const AdminDashboard = () => {
    const navigate = useNavigate();

    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['recentOrders'],
        queryFn: () => apiClient.get('/admin/orders', { params: { limit: 5 } }).then(res => res.data),
    });

    const { data: pendingData } = useQuery({
        queryKey: ['pendingOrdersCount'],
        queryFn: () => apiClient.get('/admin/orders', { params: { status: 'pending', limit: 1 } }).then(res => res.data),
    });

    const { data: customersData } = useQuery({
        queryKey: ['customersCount'],
        queryFn: () => apiClient.get('/admin/customers', { params: { limit: 1 } }).then(res => res.data),
    });

    const { data: driversData } = useQuery({
        queryKey: ['activeDriversCount'],
        queryFn: () => apiClient.get('/admin/drivers', { params: { is_available: true, limit: 1 } }).then(res => res.data),
    });

    const {
        closedShifts,
        openShifts,
        isLoading: shiftsLoading,
    } = useGlobalShifts({ maxDrivers: 200, shiftsPerDriver: 30, staleTime: 60_000 });

    const today = todayIso();
    const todayClosed = useMemo(
        () => closedShifts.filter((s) => isClosedOnDate(s, today)),
        [closedShifts, today]
    );
    const todayPayoutTotal = useMemo(() => sumPayouts(todayClosed), [todayClosed]);

    const recentClosed = useMemo(
        () => closedShifts.slice(0, 5),
        [closedShifts]
    );

    const stats: { label: string; value: string; loading: boolean; accent: string; hint?: string }[] = [
        {
            label: 'إجمالي مبالغ ورديات اليوم',
            value: shiftsLoading ? '...' : formatMoney(todayPayoutTotal),
            loading: shiftsLoading,
            accent: 'text-emerald-700 bg-emerald-50',
            hint: shiftsLoading ? '' : `${formatCount(todayClosed.length)} وردية مُغلقة`,
        },
        {
            label: 'ورديات مفتوحة الآن',
            value: shiftsLoading ? '...' : formatCount(openShifts.length),
            loading: shiftsLoading,
            accent: 'text-blue-700 bg-blue-50',
            hint: shiftsLoading ? '' : `${formatCount(driversData?.total ?? 0)} مندوب نشط`,
        },
        {
            label: 'الطلبات المعلقة',
            value: pendingData ? formatCount(pendingData.total ?? 0) : '—',
            loading: !pendingData,
            accent: 'text-yellow-700 bg-yellow-50',
        },
        {
            label: 'إجمالي العملاء',
            value: customersData ? formatCount(customersData.total ?? 0) : '—',
            loading: !customersData,
            accent: 'text-indigo-700 bg-indigo-50',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-3xl font-bold text-gray-800">نظرة عامة</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/admin/shifts')}
                        className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                        عرض الورديات الكاملة
                    </button>
                    <button
                        onClick={() => navigate('/admin/analytics')}
                        className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        التحليلات
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                        <span className={`self-start text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${stat.accent}`}>
                            {stat.label}
                        </span>
                        <p className="text-3xl font-semibold text-gray-900 mt-3 break-words">
                            {stat.loading ? '...' : stat.value}
                        </p>
                        {stat.hint && (
                            <p className="text-xs text-gray-500 mt-1">{stat.hint}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-800">أحدث الورديات المُغلقة</h3>
                        <button
                            className="text-emerald-600 font-medium hover:text-emerald-700 text-sm"
                            onClick={() => navigate('/admin/shifts')}
                        >
                            عرض الكل
                        </button>
                    </div>
                    <div className="p-2">
                        {shiftsLoading ? (
                            <p className="p-6 text-gray-500 text-sm">جارٍ تحميل الورديات...</p>
                        ) : recentClosed.length === 0 ? (
                            <p className="p-6 text-gray-500 text-sm">لا توجد ورديات مُغلقة بعد.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {recentClosed.map((s) => (
                                    <li key={s.id} className="p-4 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{s.driver_full_name}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                وردية #{s.id} • {s.closed_at ? new Date(s.closed_at).toLocaleString('ar-EG') : '—'}
                                            </p>
                                            {s.closing_note && (
                                                <p className="text-[11px] text-gray-400 truncate mt-1">{s.closing_note}</p>
                                            )}
                                        </div>
                                        <div className="text-left flex-shrink-0">
                                            <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                                                {s.recorded_payout ? formatMoney(s.recorded_payout) : '—'}
                                            </p>
                                            {s.closed_by_admin_id && (
                                                <p className="text-[11px] text-gray-400">المسؤول #{s.closed_by_admin_id}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-800">أحدث الطلبات</h3>
                        <button className="text-emerald-600 font-medium hover:text-emerald-700 text-sm" onClick={() => navigate('/admin/orders')}>عرض الكل</button>
                    </div>
                    <div className="p-2">
                        {ordersLoading ? (
                            <p className="p-6 text-gray-500 text-sm">جارٍ تحميل البيانات...</p>
                        ) : ordersData?.items?.length ? (
                            <ul className="divide-y divide-gray-100">
                                {ordersData.items.map((order: any) => (
                                    <li key={order.id} className="p-4 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{order.code}</p>
                                            <p className="text-xs text-gray-500 truncate">{order.customer.full_name}</p>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <StatusBadge status={order.status} />
                                            <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                                {formatMoney(order.price)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-6 text-gray-500 text-sm">لا توجد طلبات حديثة.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
