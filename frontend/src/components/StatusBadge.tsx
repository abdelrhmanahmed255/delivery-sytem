const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  offered:     'bg-blue-100 text-blue-800',
  assigned:    'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed:   'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-800',
  expired:     'bg-gray-100 text-gray-600',
  // driver approval
  approved:    'bg-green-100 text-green-800',
  rejected:    'bg-red-100 text-red-800',
  // offer
  accepted:    'bg-green-100 text-green-800',
  ignored:     'bg-gray-100 text-gray-600',
  skipped:     'bg-gray-100 text-gray-600',
  revoked:     'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'قيد الانتظار',
  offered:     'تم العرض',
  assigned:    'تم التعيين',
  in_progress: 'جارٍ التوصيل',
  completed:   'مكتمل',
  cancelled:   'ملغى',
  expired:     'منتهي',
  approved:    'معتمد',
  rejected:    'مرفوض',
  accepted:    'مقبول',
  ignored:     'متجاهل',
  skipped:     'تخطي',
  revoked:     'ملغى',
};

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
    {STATUS_LABELS[status] ?? status.replace('_', ' ')}
  </span>
);
