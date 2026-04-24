interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export const Pagination = ({ total, limit, offset, onPageChange }: PaginationProps) => {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        عرض {Math.min(offset + 1, total)}–{Math.min(offset + limit, total)} من إجمالي {total}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          → السابق
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={offset + limit >= total}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          التالي ←
        </button>
      </div>
    </div>
  );
};
