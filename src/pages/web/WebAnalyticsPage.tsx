// Web-specific Analytics Page inspired by Eventbrite's design
// Professional analytics dashboard

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Eye,
  MousePointer,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import WebLayout from '@/components/web/WebLayout';

export const WebAnalyticsPage: React.FC = () => {
  return (
    <WebLayout userRole="organizer">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Track your event performance and sponsorship ROI</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$45,230</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +12.5% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                <p className="text-2xl font-bold text-gray-900">2,847</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +8.2% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">24.3%</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +2.1% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Page Views</p>
                <p className="text-2xl font-bold text-gray-900">18,429</p>
                <p className="text-sm text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +15.7% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Eye className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Revenue chart will be displayed here</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendee Demographics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Demographics chart will be displayed here</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sponsorship Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Sponsorship Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Event</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Sponsor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Package</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Revenue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { event: 'Tech Conference 2024', sponsor: 'TechCorp', package: 'Premium', revenue: '$15,000', status: 'Active' },
                  { event: 'Music Festival', sponsor: 'SoundWave', package: 'Gold', revenue: '$8,500', status: 'Completed' },
                  { event: 'Startup Summit', sponsor: 'InnovateCo', package: 'Silver', revenue: '$5,200', status: 'Pending' },
                ].map((row, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{row.event}</td>
                    <td className="py-3 px-4">{row.sponsor}</td>
                    <td className="py-3 px-4">{row.package}</td>
                    <td className="py-3 px-4 font-medium">{row.revenue}</td>
                    <td className="py-3 px-4">
                      <Badge 
                        variant={row.status === 'Active' ? 'default' : row.status === 'Completed' ? 'secondary' : 'outline'}
                        className={
                          row.status === 'Active' ? 'bg-green-100 text-green-800' :
                          row.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: 'New sponsorship proposal received', time: '2 hours ago', type: 'proposal' },
              { action: 'Event "Tech Conference 2024" published', time: '4 hours ago', type: 'event' },
              { action: 'Payment of $15,000 received from TechCorp', time: '1 day ago', type: 'payment' },
              { action: 'Analytics report generated', time: '2 days ago', type: 'report' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'proposal' ? 'bg-blue-500' :
                  activity.type === 'event' ? 'bg-green-500' :
                  activity.type === 'payment' ? 'bg-purple-500' :
                  'bg-orange-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </WebLayout>
  );
};

export default WebAnalyticsPage;
