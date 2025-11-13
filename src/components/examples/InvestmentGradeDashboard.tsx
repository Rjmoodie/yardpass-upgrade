// components/examples/InvestmentGradeDashboard.tsx
import React from "react";
import { Title, Subtitle, Body, Caption } from "@/components/ui/Typography";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { Badge } from "@/components/ui/Badge";
import { TabNavigation } from "@/components/ui/TabNavigation";
import { ProgressRing } from "@/components/ui/ProgressRing";

export function InvestmentGradeDashboard() {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <div className="mx-auto max-w-[440px] px-6 py-8 space-y-6 bg-neutral-0 min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <Title>Organizer<br/>Dashboard</Title>
        <Body>Liventix Official · 5 events · 49 attendees</Body>
        <Caption>$783.56 revenue</Caption>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <PremiumButton className="flex-1">+ Create Event</PremiumButton>
        <PremiumButton variant="secondary" className="flex-1">+ New Org</PremiumButton>
      </div>

      {/* Tabs */}
      <TabNavigation 
        items={["Events", "Analytics", "More"]} 
        active={activeTab} 
        onChange={setActiveTab} 
      />

      {/* Stats Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-neutral-800">2</div>
          <Caption>Scheduled for the future</Caption>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle>Live right now</CardTitle>
            <div className="text-3xl font-semibold text-neutral-800">0</div>
            <Caption>Events currently in progress</Caption>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <ProgressRing progress={75} size={60} stroke={8} showPercentage />
            <Caption>75%</Caption>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Completed</CardTitle>
            <Badge>ACTIVE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-neutral-800">3</div>
          <Caption>Past events with results</Caption>
        </CardContent>
      </Card>

      {/* Analytics Section */}
      {activeTab === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
              <CardDescription>Last 30 days performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Total Revenue</span>
                <span className="text-2xl font-semibold text-neutral-800">$2,847</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Growth</span>
                <Badge variant="success">+12.5%</Badge>
              </div>
              <ProgressRing progress={85} size={80} stroke={6} showPercentage />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Attendance Rate</span>
                <span className="font-semibold text-neutral-800">94%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Satisfaction</span>
                <span className="font-semibold text-neutral-800">4.8/5</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* More Section */}
      {activeTab === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PremiumButton variant="outline" className="w-full justify-start">
                Account Settings
              </PremiumButton>
              <PremiumButton variant="outline" className="w-full justify-start">
                Notification Preferences
              </PremiumButton>
              <PremiumButton variant="outline" className="w-full justify-start">
                Privacy & Security
              </PremiumButton>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
