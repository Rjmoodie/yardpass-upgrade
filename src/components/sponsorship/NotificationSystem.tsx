// Real-time Notification System - Comprehensive notification management
// Handles real-time updates, messaging, and notification preferences

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  BellOff, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Star,
  DollarSign,
  Users,
  Calendar,
  Settings,
  CheckCheck,
  Trash2,
  Archive,
  Filter,
  Search,
  MoreHorizontal,
  ExternalLink,
  Clock,
  User,
  Building2,
  TrendingUp
} from 'lucide-react';
import { sponsorshipClient, formatDate } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorshipNotification,
  RealTimeMatchUpdate 
} from '@/types/sponsorship-complete';

interface NotificationSystemProps {
  userId: string;
  onNotificationClick?: (notification: SponsorshipNotification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onDeleteNotification?: (notificationId: string) => void;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  userId,
  onNotificationClick,
  onMarkAsRead,
  onDeleteNotification
}) => {
  const [notifications, setNotifications] = useState<SponsorshipNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [preferences, setPreferences] = useState({
    match_suggested: true,
    proposal_received: true,
    deliverable_due: true,
    payout_completed: true,
    match_accepted: true,
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false
  });
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    loadNotifications();
    setupRealtimeSubscription();
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [userId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // This would be implemented with a proper notifications API
      // For now, we'll use mock data
      const mockNotifications: SponsorshipNotification[] = [
        {
          id: '1',
          user_id: userId,
          type: 'match_suggested',
          title: 'New Match Found',
          message: 'We found a potential sponsor match for your event "Tech Conference 2024"',
          data: { event_id: 'event-1', sponsor_id: 'sponsor-1' },
          read_at: null,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          user_id: userId,
          type: 'proposal_received',
          title: 'New Proposal Received',
          message: 'Acme Corp has sent you a sponsorship proposal',
          data: { proposal_id: 'proposal-1' },
          read_at: new Date(Date.now() - 3600000).toISOString(),
          created_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '3',
          user_id: userId,
          type: 'deliverable_due',
          title: 'Deliverable Due Soon',
          message: 'Your logo placement deliverable is due in 2 days',
          data: { deliverable_id: 'deliverable-1' },
          read_at: null,
          created_at: new Date(Date.now() - 7200000).toISOString()
        }
      ];
      
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read_at).length);
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    try {
      // Subscribe to real-time notifications
      subscriptionRef.current = sponsorshipClient.subscribeToNotifications(
        userId,
        (notification) => {
          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      );
      setIsConnected(true);
    } catch (err) {
      console.error('Error setting up real-time subscription:', err);
      setIsConnected(false);
    }
  };

  const handleNotificationClick = (notification: SponsorshipNotification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Update local state immediately for optimistic UI
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      onMarkAsRead?.(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read_at);
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      
      // Mark all as read in backend
      for (const notification of unreadNotifications) {
        onMarkAsRead?.(notification.id);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      onDeleteNotification?.(notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'match_suggested':
        return <Star className="h-4 w-4 text-yellow-600" />;
      case 'proposal_received':
        return <MessageSquare className="h-4 w-4 text-blue-600" />;
      case 'deliverable_due':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'payout_completed':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'match_accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'match_suggested':
        return 'border-yellow-200 bg-yellow-50';
      case 'proposal_received':
        return 'border-blue-200 bg-blue-50';
      case 'deliverable_due':
        return 'border-orange-200 bg-orange-50';
      case 'payout_completed':
        return 'border-green-200 bg-green-50';
      case 'match_accepted':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (activeTab) {
      case 'unread':
        return !notification.read_at;
      case 'matches':
        return notification.type.includes('match');
      case 'proposals':
        return notification.type.includes('proposal');
      case 'deliverables':
        return notification.type.includes('deliverable');
      case 'payments':
        return notification.type.includes('payout');
      default:
        return true;
    }
  });

  const NotificationCard: React.FC<{ notification: SponsorshipNotification }> = ({ 
    notification 
  }) => {
    const isUnread = !notification.read_at;
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${
          isUnread ? 'border-l-4 border-l-primary' : ''
        } ${getNotificationColor(notification.type)}`}
        onClick={() => handleNotificationClick(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`text-sm font-medium ${
                    isUnread ? 'text-gray-900' : 'text-gray-700'
                  }`}>
                    {notification.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {isUnread && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(notification.created_at)}</span>
                </div>
                
                <Badge variant="outline" className="text-xs">
                  {notification.type.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-2">Error loading notifications</div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadNotifications}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground">
                    You'll receive notifications about matches, proposals, and more
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <p className="text-muted-foreground">All caught up!</p>
                  <p className="text-sm text-muted-foreground">
                    No unread notifications
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No match notifications</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No proposal notifications</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No deliverable notifications</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No payment notifications</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Notification Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Notification Types</h4>
              <div className="space-y-2">
                {Object.entries(preferences).filter(([key]) => !key.includes('_notifications')).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm capitalize">
                      {key.replace('_', ' ')}
                    </label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Delivery Methods</h4>
              <div className="space-y-2">
                {Object.entries(preferences).filter(([key]) => key.includes('_notifications')).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm capitalize">
                      {key.replace('_notifications', '')}
                    </label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => 
                        setPreferences(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSystem;
