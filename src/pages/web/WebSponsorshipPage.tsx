// Web-specific Sponsorship Page inspired by Eventbrite's design
// Professional, management-focused interface

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp,
  Calendar,
  MapPin,
  Star,
  ArrowRight,
  CheckCircle,
  Target,
  Zap,
  Shield,
  Clock,
  Search,
  Filter,
  Plus
} from 'lucide-react';
import WebLayout from '@/components/web/WebLayout';

export const WebSponsorshipPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('marketplace');

  return (
    <WebLayout userRole="organizer">
      {/* Hero Section - Yardpass Style */}
      <section className="py-16 bg-white rounded-2xl mb-12 border border-gray-100">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 mb-6">
            Sponsorship
            <span className="block text-yellow-500">Marketplace</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-600 max-w-3xl mx-auto">
            Connect with sponsors and grow your events with our comprehensive sponsorship platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gray-900 text-white hover:bg-gray-800 px-8 py-3">
              Browse Opportunities
            </Button>
            <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3">
              Create Proposal
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="grid w-full grid-cols-4 bg-gray-50 p-1 rounded-lg border border-gray-200">
          <TabsTrigger value="marketplace" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="proposals" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Proposals
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-8">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search sponsorship opportunities..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sponsorship Opportunities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Card key={item} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="ml-1 text-sm">4.8</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">Tech Conference 2024</CardTitle>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>Dec 15, 2024</span>
                    <MapPin className="h-4 w-4 ml-4 mr-1" />
                    <span>San Francisco, CA</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">
                    Looking for tech sponsors for our annual conference. 500+ attendees expected.
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-green-600">$5,000</span>
                      <span className="text-gray-600 text-sm ml-1">/package</span>
                    </div>
                    <Button size="sm">
                      View Details
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">24</div>
                <p className="text-gray-600">Active Proposals</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">$45K</div>
                <p className="text-gray-600">Total Revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">89%</div>
                <p className="text-gray-600">Success Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">156</div>
                <p className="text-gray-600">Total Views</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Analytics Chart Placeholder</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Proposals</h2>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Button>
          </div>

          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <Card key={item}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Music Festival Sponsorship</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Proposal for Summer Music Festival 2024 - Premium sponsorship package
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Sent 2 days ago</span>
                        <span>•</span>
                        <span>Waiting for response</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">Pending</Badge>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Sponsorship Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Information
                </label>
                <input
                  type="text"
                  placeholder="Your company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Range
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>$1,000 - $5,000</option>
                  <option>$5,000 - $10,000</option>
                  <option>$10,000 - $25,000</option>
                  <option>$25,000+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Industries
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Technology', 'Healthcare', 'Finance', 'Education'].map((industry) => (
                    <Badge key={industry} variant="secondary" className="cursor-pointer hover:bg-blue-100">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="w-full">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WebLayout>
  );
};

export default WebSponsorshipPage;
