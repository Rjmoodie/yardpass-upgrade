import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WalletTransaction } from "@/hooks/useWallet";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Settings } from "lucide-react";

interface WalletTransactionsTableProps {
  transactions: WalletTransaction[];
}

export const WalletTransactionsTable = ({ transactions }: WalletTransactionsTableProps) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case "spend":
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case "refund":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "purchase":
      case "promo":
        return "default";
      case "spend":
        return "destructive";
      case "refund":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="text-sm">
              {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getTypeIcon(tx.type)}
                <Badge variant={getTypeColor(tx.type)}>{tx.type}</Badge>
              </div>
            </TableCell>
            <TableCell>
              <span
                className={
                  tx.credits_delta > 0
                    ? "text-green-600 font-medium"
                    : "text-red-600 font-medium"
                }
              >
                {tx.credits_delta > 0 ? "+" : ""}
                {tx.credits_delta.toLocaleString()} credits
              </span>
              {tx.usd_cents && (
                <span className="text-xs text-muted-foreground ml-2">
                  (${(Math.abs(tx.usd_cents) / 100).toFixed(2)})
                </span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {tx.memo || tx.reference_type || "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};