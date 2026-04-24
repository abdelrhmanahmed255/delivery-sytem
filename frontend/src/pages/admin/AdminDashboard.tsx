import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';

export const AdminDashboard = () => {
    // Quick example calling /admin/activity or orders
    const { data, isLoading } = useQuery({
        queryKey: ['recentOrders'],
        queryFn: () => apiClient.get('/admin/orders', { params: { limit: 5 } }).then(res => res.data),
    });

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">نظرة عامة</h2>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {['الطلبات المعلقة', 'المناديب النشطون', 'إيرادات اليوم', 'إجمالي العملاء'].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500">{stat}</p>
                        <p className="text-3xl font-semibold text-gray-900 mt-2">—</p>
                    </div>
                ))}
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">أحدث الطلبات</h3>
                    <button className="text-emerald-600 font-medium hover:text-emerald-700 text-sm">عرض الكل</button>
                </div>
                <div className="p-6">
                    {isLoading ? (
                        <p className="text-gray-500">جارٍ تحميل البيانات...</p>
                    ) : data?.items?.length ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">الكود</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">الحالة</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">العميل</th>
                                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">السعر</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.items.map((order: any) => (
                                    <tr key={order.id}>
                                        <td className="py-3 text-sm font-medium text-gray-900">{order.code}</td>
                                        <td className="py-3 text-sm">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="py-3 text-sm font-medium text-gray-700">{order.customer.full_name}</td>
                                        <td className="py-3 text-sm font-semibold text-gray-900">{order.price} ج.م</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-gray-500">لا توجد طلبات حديثة.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
