// Web-specific layout inspired by Eventbrite's design
// Professional, management-focused web interface

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Clock
} from 'lucide-react';

interface WebLayoutProps {
  children: React.ReactNode;
  userRole?: 'organizer' | 'sponsor' | 'admin';
}

export const WebLayout: React.FC<WebLayoutProps> = ({ children, userRole = 'organizer' }) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar - Tokenized Design */}
      <nav className="bg-card sticky top-0 z-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row - Categories */}
          <div className="flex items-center justify-center py-2 border-b border-gray-100">
            <div className="flex items-center space-x-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span>Content Creation</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Trading & Investing</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Coding</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Personal</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Business</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Presentations</span>
              </span>
              <span className="flex items-center gap-1">
                <span>Research Tools</span>
              </span>
              <span className="flex items-center gap-1">
                <span>AI</span>
              </span>
            </div>
          </div>
          
          {/* Main Navigation Row */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-8">
              {/* Liventix Logo */}
              <div className="flex items-center space-x-3">
                <img 
                  src="/liventix-icon-60.png" 
                  alt="Liventix" 
                  className="w-8 h-8 object-contain"
                  loading="eager"
                  decoding="sync"
                />
                <span className="text-xl font-bold text-gray-900">Liventix</span>
                <span className="text-xs text-gray-500 bg-yellow-50 px-2 py-1 rounded-full">
                  Now in Beta
                </span>
              </div>
            </div>
            
            {/* Navigation Items */}
            <div className="flex items-center space-x-8">
              {/* Feed - Active */}
              <div className="flex items-center space-x-3">
                <div className="bg-brand-400 px-4 py-2 rounded-lg flex items-center space-x-2">
                  <Home className="h-4 w-4 text-white" />
                  <span className="text-white font-medium">Feed</span>
                </div>
                <div className="text-xs text-gray-500">Live updates across events</div>
              </div>
              
              {/* Search */}
              <div className="flex items-center space-x-3">
                <Search className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Search</span>
                <div className="text-xs text-gray-500">Find events, people, and sponsors</div>
              </div>
              
              {/* Sponsorship */}
              <div className="flex items-center space-x-3">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Sponsorship</span>
              </div>
              
              {/* Marketplace */}
              <div className="flex items-center space-x-3">
                <Building2 className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Marketplace & proposals</span>
              </div>
              
              {/* Analytics */}
              <div className="flex items-center space-x-3">
                <BarChart3 className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Analytics</span>
                <div className="text-xs text-gray-500">Deep performance reporting</div>
              </div>
              
              {/* Dashboard */}
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Dashboard</span>
                <div className="text-xs text-gray-500">Manage events & teams</div>
              </div>
              
              {/* Payments */}
              <div className="flex items-center space-x-3">
                <DollarSign className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Payments</span>
                <div className="text-xs text-gray-500">Disbursements & escrow</div>
              </div>
              
              {/* Profile */}
              <div className="flex items-center space-x-3">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-gray-700 font-medium">Profile</span>
                <div className="text-xs text-gray-500">Account preferences</div>
              </div>
            </div>
          </div>
        </div>
      </nav>


      {/* Main Content - Clean Layout */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Content */}
          {children}
        </div>
      </main>

    </div>
  );
};

export default WebLayout;
