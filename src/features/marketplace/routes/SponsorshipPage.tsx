// Main Sponsorship Page - Complete sponsorship system integration
// Brings together all sponsorship components in a unified interface

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Bell, 
  Settings,
  Plus,
  Search,
  Filter,
  BarChart3,
  MessageSquare,
  Shield,
  Star
} from 'lucide-react';

// Import all sponsorship components
import SponsorshipMarketplace from '@/components/sponsorship/SponsorshipMarketplace';
import SponsorProfileManager from '@/components/sponsorship/SponsorProfileManager';
import MatchAlgorithm from '@/components/sponsorship/MatchAlgorithm';
import ProposalNegotiation from '@/components/sponsorship/ProposalNegotiation';
import PaymentEscrowManager from '@/components/sponsorship/PaymentEscrowManager';
import AnalyticsDashboard from '@/components/sponsorship/AnalyticsDashboard';
import NotificationSystem from '@/components/sponsorship/NotificationSystem';

interface SponsorshipPageProps {
  userRole?: 'organizer' | 'sponsor' | 'admin';
  eventId?: string;
  sponsorId?: string;
}

export const SponsorshipPage: React.FC<SponsorshipPageProps> = ({
  userRole = 'organizer',
  eventId,
  sponsorId
}) => {
  const [activeTab, setActiveTab] = useState('marketplace');
  const [notifications, setNotifications] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      // Load user data and determine role
      // This would integrate with your auth system
      setUser({ id: 'user-1', role: userRole });
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (packageId: string) => {
    console.log('Package selected:', packageId);
    // Navigate to package details or open modal
  };

  const handleMatchAction = (matchId: string, action: string) => {
    console.log('Match action:', { matchId, action });
    // Handle match actions (accept, reject, contact)
  };

  const handleProposalAction = (proposalId: string, action: string) => {
    console.log('Proposal action:', { proposalId, action });
    // Handle proposal actions
  };

  const handlePaymentComplete = (orderId: string) => {
    console.log('Payment completed:', orderId);
    // Handle payment completion
  };

  const handleNotificationClick = (notification: any) => {
    console.log('Notification clicked:', notification);
    // Handle notification navigation
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'marketplace':
        return (
          <SponsorshipMarketplace
            onPackageSelect={handlePackageSelect}
          />
        );
      
      case 'profile':
        return (
          <SponsorProfileManager
            sponsorId={sponsorId}
            mode={sponsorId ? 'edit' : 'create'}
            onSave={(sponsor) => console.log('Sponsor saved:', sponsor)}
            onCancel={() => console.log('Profile creation cancelled')}
          />
        );
      
      case 'matches':
        return (
          <MatchAlgorithm
            eventId={eventId}
            sponsorId={sponsorId}
            onMatchSelect={(matchId) => console.log('Match selected:', matchId)}
            onMatchAction={handleMatchAction}
          />
        );
      
      case 'proposals':
        return (
          <ProposalNegotiation
            threadId="thread-1" // This would be dynamic
            onMessageSend={(message, offer) => console.log('Message sent:', { message, offer })}
            onAccept={() => console.log('Proposal accepted')}
            onReject={(reason) => console.log('Proposal rejected:', reason)}
          />
        );
      
      case 'payments':
        return (
          <PaymentEscrowManager
            orderId={eventId}
            onPaymentComplete={handlePaymentComplete}
            onPayoutProcessed={(payoutId) => console.log('Payout processed:', payoutId)}
          />
        );
      
      case 'analytics':
        return (
          <AnalyticsDashboard
            eventId={eventId}
            sponsorId={sponsorId}
            onExport={(data) => console.log('Analytics exported:', data)}
          />
        );
      
      case 'notifications':
        return (
          <NotificationSystem
            userId={user?.id || 'user-1'}
            onNotificationClick={handleNotificationClick}
            onMarkAsRead={(id) => console.log('Notification marked as read:', id)}
            onDeleteNotification={(id) => console.log('Notification deleted:', id)}
          />
        );
      
      default:
        return <div>Select a tab to get started</div>;
    }
  };

  const getAvailableTabs = () => {
    const baseTabs = [
      { id: 'marketplace', label: 'Marketplace', icon: Search },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'notifications', label: 'Notifications', icon: Bell }
    ];

    if (userRole === 'sponsor') {
      return [
        ...baseTabs,
        { id: 'profile', label: 'Profile', icon: Building2 },
        { id: 'matches', label: 'Matches', icon: Star },
        { id: 'proposals', label: 'Proposals', icon: MessageSquare }
      ];
    } else if (userRole === 'organizer') {
      return [
        ...baseTabs,
        { id: 'matches', label: 'Matches', icon: Star },
        { id: 'proposals', label: 'Proposals', icon: MessageSquare },
        { id: 'payments', label: 'Payments', icon: DollarSign }
      ];
    } else if (userRole === 'admin') {
      return [
        ...baseTabs,
        { id: 'matches', label: 'Matches', icon: Star },
        { id: 'proposals', label: 'Proposals', icon: MessageSquare },
        { id: 'payments', label: 'Payments', icon: DollarSign },
        { id: 'profile', label: 'Profile', icon: Building2 }
      ];
    }

    return baseTabs;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold">Sponsorship Platform</h1>
                <p className="text-sm text-muted-foreground">
                  {userRole === 'sponsor' ? 'Find and connect with events' :
                   userRole === 'organizer' ? 'Manage sponsorships and partnerships' :
                   'Admin dashboard for sponsorship management'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {notifications > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {notifications} new
                </Badge>
              )}
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              
              {userRole === 'sponsor' && (
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold">$24,500</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Matches</p>
                  <p className="text-xl font-bold">12</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  <p className="text-xl font-bold">68%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Notifications</p>
                  <p className="text-xl font-bold">{notifications}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            {getAvailableTabs().map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {getTabContent()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SponsorshipPage;
