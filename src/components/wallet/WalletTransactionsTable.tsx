import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { fetchWalletTx } from '@/lib/api/wallet';

export default function WalletTransactionsTable({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isFetching } = useQuery({
    queryKey: ['wallet-tx', orgId, page, limit],
    queryFn: () => fetchWalletTx({ orgId, page, limit }),
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  return (
    <div className="space-y-2">
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Credits Δ</th>
              <th className="px-3 py-2">Memo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.type}</td>
                <td className="px-3 py-2">{r.credits_delta}</td>
                <td className="px-3 py-2">{r.memo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={page===1} onClick={() => setPage(p => p-1)} className="btn">Prev</button>
        <span className="text-sm opacity-70">Page {page} / {totalPages}</span>
        <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)} className="btn">Next</button>
        {isFetching && <span className="text-sm opacity-70">Loading…</span>}
      </div>
    </div>
  );
}