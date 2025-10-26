import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { fetchWalletTx } from '@/lib/api/wallet';
import { ArrowDownCircle, ArrowUpCircle, Receipt, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  // Calculate running balance (assuming most recent first)
  const rowsWithBalance = useMemo(() => {
    if (!rows.length) return [];
    
    // We need to reverse to calculate from oldest to newest, then reverse back
    const reversed = [...rows].reverse();
    let runningBalance = 0;
    
    const withBalance = reversed.map((r: any, idx: number) => {
      if (idx === 0) {
        // For the oldest transaction on this page, we don't know the balance before
        // Just show the running balance as we go forward
        runningBalance = r.credits_delta;
      } else {
        runningBalance += r.credits_delta;
      }
      return { ...r, balance: runningBalance };
    });
    
    return withBalance.reverse();
  }, [rows]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case 'spend':
        return <ArrowUpCircle className="h-4 w-4 text-blue-600" />;
      case 'refund':
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      case 'adjustment':
        return <AlertCircle className="h-4 w-4 text-purple-600" />;
      default:
        return <Receipt className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'Credit Purchase';
      case 'spend':
        return 'Campaign Spend';
      case 'refund':
        return 'Refund';
      case 'adjustment':
        return 'Adjustment';
      default:
        return type;
    }
  };

  const formatCredits = (delta: number) => {
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toLocaleString()}`;
  };

  if (rows.length === 0 && !isFetching) {
    return (
      <div className="border rounded-xl p-12 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
        <p className="text-sm text-muted-foreground">
          Purchase credits to get started with your campaigns
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-xl overflow-hidden bg-card">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rowsWithBalance.map((r: any) => {
              const isCredit = r.credits_delta > 0;
              
              return (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    <br />
                    <span className="text-xs">
                      {new Date(r.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(r.transaction_type)}
                      <div>
                        <div className="text-sm font-medium">{getTypeLabel(r.transaction_type)}</div>
                      </div>
                    </div>
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right text-sm font-medium",
                    !isCredit && "text-red-600"
                  )}>
                    {!isCredit ? formatCredits(r.credits_delta) : '—'}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right text-sm font-medium",
                    isCredit && "text-green-600"
                  )}>
                    {isCredit ? formatCredits(r.credits_delta) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {r.balance?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    {r.description || 'No description'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {rows.length} of {total.toLocaleString()} transactions
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={page === 1 || isFetching} 
            onClick={() => setPage(p => p - 1)} 
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
          <button 
            disabled={page >= totalPages || isFetching} 
            onClick={() => setPage(p => p + 1)} 
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
          {isFetching && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}