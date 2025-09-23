import { CreditCard, Download, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SponsorBillingProps {
  sponsorId: string | null;
}

export function SponsorBilling({ sponsorId }: SponsorBillingProps) {
  if (!sponsorId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No Sponsor Selected</h3>
          <p className="text-muted-foreground">Please select a sponsor account to view billing information.</p>
        </CardContent>
      </Card>
    );
  }

  // Mock data - in a real app, this would come from API
  const paymentMethods = [
    {
      id: "1",
      type: "card",
      last4: "4242",
      brand: "Visa",
      expiry: "12/26",
      isDefault: true
    }
  ];

  const invoices = [
    {
      id: "inv_001",
      date: "2024-01-15",
      amount: 5000,
      status: "paid",
      description: "Tech Conference 2024 - Gold Sponsorship"
    },
    {
      id: "inv_002", 
      date: "2024-01-10",
      amount: 2500,
      status: "paid",
      description: "Startup Meetup - Silver Sponsorship"
    },
    {
      id: "inv_003",
      date: "2024-01-05",
      amount: 10000,
      status: "pending",
      description: "Annual Summit - Presenting Sponsorship"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Billing & Payments</h2>
        <p className="text-muted-foreground">
          Manage your payment methods, view invoices, and track spending.
        </p>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment Methods</CardTitle>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
              <p className="text-muted-foreground mb-4">Add a payment method to start purchasing sponsorships.</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {method.brand} •••• {method.last4}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Expires {method.expiry}
                      </div>
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="outline" size="sm">Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spending Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">$17,500</div>
            <div className="text-sm text-muted-foreground">Total Spent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">$12,500</div>
            <div className="text-sm text-muted-foreground">This Month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">$10,000</div>
            <div className="text-sm text-muted-foreground">In Escrow</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Invoices</CardTitle>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">
                    {invoice.id}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{invoice.description}</div>
                  </TableCell>
                  <TableCell>
                    {new Date(invoice.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    ${(invoice.amount / 100).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                      className={
                        invoice.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Information */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Business Tax ID</label>
              <div className="mt-1 text-sm text-muted-foreground">Not provided</div>
            </div>
            <div>
              <label className="text-sm font-medium">Tax Forms</label>
              <div className="mt-1">
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-2" />
                  Download W-9
                </Button>
              </div>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Tax Information Notice</h4>
            <p className="text-sm text-muted-foreground">
              Please consult with your tax advisor regarding the deductibility of sponsorship expenses. 
              We'll provide necessary documentation for your records.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}