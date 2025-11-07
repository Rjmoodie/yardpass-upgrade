import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, DollarSign, Package, Handshake, TrendingUp, Eye, CheckCircle, X, Edit, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEventSponsorships } from '@/hooks/useEventSponsorships';
import { 
  SponsorshipPackageRecord, 
  SponsorshipOrderRecord,
  EventSponsorshipManagementProps,
  SponsorshipPackageFormData 
} from '@/types/sponsorship';
import { 
  isCommittedStatus, 
  isPendingStatus,
  getStatusColorClasses,
  getStatusLabel 
} from '@/constants/sponsorship';
import { formatCentsAsCurrency, formatNumber } from '@/utils/formatters';

const defaultPackageData: SponsorshipPackageFormData = {
  tier: '',
  price_cents: 0,
  inventory: 1,
  benefits: {},
  visibility: 'public'
};

export function EventSponsorshipManagement({ eventId, onDataChange }: EventSponsorshipManagementProps) {
  const { toast } = useToast();
  const { sponsorships, loading: sponsorshipsLoading, refresh: refreshSponsorships } = useEventSponsorships(eventId);
  
  const [packages, setPackages] = useState<SponsorshipPackageRecord[]>([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const [orders, setOrders] = useState<SponsorshipOrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [packageData, setPackageData] = useState<SponsorshipPackageFormData>(defaultPackageData);
  const [benefitKey, setBenefitKey] = useState('');
  const [benefitValue, setBenefitValue] = useState('');
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());

  const fetchPackages = useCallback(async () => {
    setPackageLoading(true);
    try {
      const { data, error } = await supabase
        .from('sponsorship_packages')
        .select('id, event_id, title, tier, price_cents, inventory, sold, visibility, is_active, benefits, created_at')
        .eq('event_id', eventId)
        .order('price_cents', { ascending: false });

      if (error) throw error;
      
      const typedPackages: SponsorshipPackageRecord[] = (data || []).map(pkg => ({
        id: pkg.id,
        event_id: pkg.event_id,
        title: pkg.title ?? null,
        tier: pkg.tier ?? null,
        price_cents: pkg.price_cents ?? 0,
        inventory: pkg.inventory,
        sold: pkg.sold,
        visibility: pkg.visibility,
        is_active: pkg.is_active,
        benefits: pkg.benefits ?? {}, // Always return object, never null
        created_at: pkg.created_at,
      }));
      
      setPackages(typedPackages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sponsorship packages';
      console.error('Error fetching packages:', error);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setPackageLoading(false);
    }
  }, [eventId, toast]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      // Fetch orders first
      const { data: ordersData, error: ordersError } = await supabase
        .from('sponsorship_orders')
        .select('id, event_id, package_id, sponsor_id, amount_cents, status, created_at, updated_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Get unique sponsor IDs and package IDs
      const sponsorIds = [...new Set(ordersData.map(o => o.sponsor_id))];
      const packageIds = [...new Set(ordersData.map(o => o.package_id))];

      // Fetch sponsors separately
      const { data: sponsorsData, error: sponsorsError } = await supabase
        .from('sponsors')
        .select('id, name, logo_url')
        .in('id', sponsorIds);

      if (sponsorsError) {
        console.error('Error fetching sponsors for orders:', sponsorsError);
      }

      // Fetch packages separately  
      const { data: packagesData, error: packagesError } = await supabase
        .from('sponsorship_packages')
        .select('id, tier, title')
        .in('id', packageIds);

      if (packagesError) {
        console.error('Error fetching packages for orders:', packagesError);
      }

      // Create lookup maps
      const sponsorsMap = new Map(sponsorsData?.map(s => [s.id, s]) || []);
      const packagesMap = new Map(packagesData?.map(p => [p.id, p]) || []);

      // Join data in application code
      const typedOrders: SponsorshipOrderRecord[] = ordersData.map(order => {
        const sponsor = sponsorsMap.get(order.sponsor_id);
        const pkg = packagesMap.get(order.package_id);
        
        return {
          id: order.id,
          event_id: order.event_id,
          package_id: order.package_id,
          sponsor_id: order.sponsor_id,
          amount_cents: order.amount_cents ?? 0,
          status: order.status ?? 'pending',
          created_at: order.created_at,
          updated_at: order.updated_at,
          sponsor_name: sponsor?.name ?? null,
          sponsor_logo: sponsor?.logo_url ?? null,
          package_tier: pkg?.tier ?? pkg?.title ?? null,
          package_title: pkg?.title ?? null,
        };
      });
      
      setOrders(typedOrders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sponsorship orders';
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setOrdersLoading(false);
    }
  }, [eventId, toast]);

  // Fetch data when eventId changes
  useEffect(() => {
    fetchPackages();
    fetchOrders();
  }, [fetchPackages, fetchOrders]);

  const handleCreatePackage = async () => {
    if (!packageData.tier || packageData.price_cents <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setCreatingPackage(true);
    try {
      const { error } = await supabase
        .from('sponsorship_packages')
        .insert({
          event_id: eventId,
          tier: packageData.tier,
          title: packageData.title,
          price_cents: packageData.price_cents,
          inventory: packageData.inventory,
          benefits: packageData.benefits,
          visibility: packageData.visibility
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Sponsorship package created successfully'
      });

      setShowCreatePackage(false);
      setPackageData(defaultPackageData);
      await fetchPackages();
      onDataChange?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create sponsorship package';
      console.error('Error creating package:', error);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setCreatingPackage(false);
    }
  };

  const handleAddBenefit = () => {
    if (benefitKey && benefitValue) {
      setPackageData(prev => ({
        ...prev,
        benefits: { ...prev.benefits, [benefitKey]: benefitValue }
      }));
      setBenefitKey('');
      setBenefitValue('');
    }
  };

  const handleRemoveBenefit = (key: string) => {
    setPackageData(prev => {
      const newBenefits = { ...prev.benefits };
      delete newBenefits[key];
      return { ...prev, benefits: newBenefits };
    });
  };

  const handleOrderAction = async (orderId: string, action: 'accept' | 'reject') => {
    // Add to processing set
    setProcessingOrders(prev => new Set(prev).add(orderId));
    
    const newStatus = action === 'accept' ? 'accepted' : 'cancelled';
    
    // Optimistic update
    const previousOrders = [...orders];
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));

    try {
      const { error } = await supabase
        .from('sponsorship_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Sponsorship request ${action}ed successfully`
      });

      // Fetch fresh data to ensure consistency
      await Promise.all([fetchOrders(), refreshSponsorships()]);
      onDataChange?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} sponsorship request`;
      console.error('Error updating order:', error);
      
      // Revert optimistic update on error
      setOrders(previousOrders);
      
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      // Remove from processing set
      setProcessingOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Memoize derived values to avoid recalculation on every render
  const totalRevenue = useMemo(
    () => orders
      .filter(o => isCommittedStatus(o.status))
      .reduce((sum, o) => sum + o.amount_cents, 0),
    [orders]
  );

  const activeSponsors = useMemo(
    () => sponsorships.filter(s => s.status === 'active').length,
    [sponsorships]
  );
  
  const pendingRequests = useMemo(
    () => orders.filter(o => isPendingStatus(o.status)).length,
    [orders]
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCentsAsCurrency(totalRevenue)}</div>
                <div className="text-sm text-muted-foreground">Sponsor Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Handshake className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{activeSponsors}</div>
                <div className="text-sm text-muted-foreground">Active Sponsors</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{packages.length}</div>
                <div className="text-sm text-muted-foreground">Packages Available</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatNumber(pendingRequests)}</div>
                <div className="text-sm text-muted-foreground">Pending Requests</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="active">Active Sponsors</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sponsorship Packages</CardTitle>
              <Dialog open={showCreatePackage} onOpenChange={setShowCreatePackage}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Package
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Sponsorship Package</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tier">Tier Name</Label>
                      <Input
                        id="tier"
                        placeholder="e.g., Gold, Silver, Presenting"
                        value={packageData.tier}
                        onChange={(e) => setPackageData(prev => ({ ...prev, tier: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price ($)</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="5000"
                        min="0"
                        step="0.01"
                        value={packageData.price_cents / 100 || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Handle empty string explicitly to avoid NaN
                          setPackageData(prev => ({ 
                            ...prev, 
                            price_cents: value === '' ? 0 : Math.round(Number(value) * 100)
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="inventory">Available Spots</Label>
                      <Input
                        id="inventory"
                        type="number"
                        placeholder="1"
                        value={packageData.inventory}
                        onChange={(e) => setPackageData(prev => ({ ...prev, inventory: Number(e.target.value) }))}
                      />
                    </div>
                    
                    <div>
                      <Label>Benefits</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Benefit name"
                            value={benefitKey}
                            onChange={(e) => setBenefitKey(e.target.value)}
                          />
                          <Input
                            placeholder="Description"
                            value={benefitValue}
                            onChange={(e) => setBenefitValue(e.target.value)}
                          />
                          <Button variant="outline" onClick={handleAddBenefit}>Add</Button>
                        </div>
                        
                        {Object.entries(packageData.benefits).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="text-sm">{key}: {String(value)}</span>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveBenefit(key)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCreatePackage(false)} 
                        className="flex-1"
                        disabled={creatingPackage}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreatePackage} 
                        className="flex-1"
                        disabled={creatingPackage}
                      >
                        {creatingPackage ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Package'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {packageLoading ? (
                <div className="text-center py-8">Loading packages...</div>
              ) : packages.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No sponsorship packages yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first sponsorship package to start attracting sponsors.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <Card key={pkg.id} className="border">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{pkg.tier}</CardTitle>
                          <Badge variant={pkg.visibility === 'public' ? 'brand' : 'neutral'}>
                            {pkg.visibility}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCentsAsCurrency(pkg.price_cents)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(pkg.inventory ?? 0)} spot{pkg.inventory !== 1 ? 's' : ''} available
                        </div>
                        {Object.keys(pkg.benefits).length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">Benefits:</div>
                            <div className="space-y-1">
                              {Object.entries(pkg.benefits).slice(0, 3).map(([key, value]) => (
                                <div key={key} className="text-xs text-muted-foreground">
                                  • {key}: {String(value)}
                                </div>
                              ))}
                              {Object.keys(pkg.benefits).length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{Object.keys(pkg.benefits).length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* TODO: Implement edit functionality - reuse dialog with prefilled packageData */}
                        <Button variant="outline" size="sm" className="w-full" disabled>
                          <Edit className="h-3 w-3 mr-2" />
                          Edit Package
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sponsorship Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8">Loading requests...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No sponsorship requests yet</h3>
                  <p className="text-muted-foreground">Requests will appear here when sponsors are interested in your packages.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.sponsor_name || 'Unknown Sponsor'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{order.package_tier || order.package_title || 'Unknown Package'}</TableCell>
                        <TableCell>{formatCentsAsCurrency(order.amount_cents)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColorClasses(order.status as any)}>
                            {getStatusLabel(order.status as any)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {isPendingStatus(order.status) && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleOrderAction(order.id, 'accept')}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={processingOrders.has(order.id)}
                              >
                                {processingOrders.has(order.id) ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                )}
                                Accept
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleOrderAction(order.id, 'reject')}
                                disabled={processingOrders.has(order.id)}
                              >
                                {processingOrders.has(order.id) ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3 mr-1" />
                                )}
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sponsors</CardTitle>
            </CardHeader>
            <CardContent>
              {sponsorshipsLoading ? (
                <div className="text-center py-8">Loading sponsors...</div>
              ) : sponsorships.length === 0 ? (
                <div className="text-center py-8">
                  <Handshake className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active sponsors yet</h3>
                  <p className="text-muted-foreground">Active sponsorships will appear here after accepting requests.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sponsorships.map((sponsorship) => (
                    <Card key={`${sponsorship.sponsor_id}-${sponsorship.tier}`} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{sponsorship.sponsor_name}</h4>
                            <Badge variant="neutral">{sponsorship.tier}</Badge>
                          </div>
                          {sponsorship.sponsor_logo_url && (
                            <img 
                              src={sponsorship.sponsor_logo_url} 
                              alt="Sponsor logo" 
                              className="w-8 h-8 rounded"
                            />
                          )}
                        </div>
                        <div className="text-lg font-bold text-green-600 mb-2">
                          {formatCentsAsCurrency(sponsorship.amount_cents)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Since {new Date(sponsorship.created_at).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}