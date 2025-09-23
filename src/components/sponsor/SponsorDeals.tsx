import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSponsorDeals } from "@/hooks/useSponsorDeals";
import { Calendar, DollarSign, ExternalLink, Upload } from "lucide-react";

interface SponsorDealsProps {
  sponsorId: string | null;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  live: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  refunded: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function SponsorDeals({ sponsorId }: SponsorDealsProps) {
  const { deals, loading, error } = useSponsorDeals(sponsorId);

  if (!sponsorId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No Sponsor Selected</h3>
          <p className="text-muted-foreground">Please select a sponsor account to view deals.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading deals...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Deals</h3>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Sponsorship Deals Yet</h3>
          <p className="text-muted-foreground mb-4">
            You haven't submitted any sponsorship requests yet. Browse the marketplace to find opportunities.
          </p>
          <Button>Browse Marketplace</Button>
        </CardContent>
      </Card>
    );
  }

  // Group deals by status for better organization
  const dealsByStatus = deals.reduce((acc, deal) => {
    if (!acc[deal.status]) acc[deal.status] = [];
    acc[deal.status].push(deal);
    return acc;
  }, {} as Record<string, typeof deals>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{deals.length}</div>
            <div className="text-sm text-muted-foreground">Total Deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {dealsByStatus.live?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {dealsByStatus.pending?.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              ${deals.reduce((sum, deal) => sum + (deal.amount_cents / 100), 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total Value</div>
          </CardContent>
        </Card>
      </div>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deal.event_title}</div>
                      {deal.notes && (
                        <div className="text-sm text-muted-foreground">{deal.notes}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {(deal.amount_cents / 100).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[deal.status] || "bg-gray-100 text-gray-800"}>
                      {deal.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {new Date(deal.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {deal.status === 'accepted' && (
                        <Button size="sm" variant="outline">
                          <Upload className="h-3 w-3 mr-1" />
                          Upload Assets
                        </Button>
                      )}
                      {deal.status === 'live' && (
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Event
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}