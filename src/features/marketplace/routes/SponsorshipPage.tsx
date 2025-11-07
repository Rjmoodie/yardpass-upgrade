// Sponsorship Discovery Hub - Public marketplace and entry point
// Lightweight page to browse opportunities and direct users to their workspaces

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  BarChart3,
  ArrowRight,
  Sparkles,
  Target,
  Zap,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { SponsorMarketplace } from '@/components/sponsor/SponsorMarketplace';
import { useAuth } from '@/contexts/AuthContext';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import {
  trackMarketplaceBrowse,
  trackCTAClick,
  startBrowseSession,
  clearBrowseSession,
  endBrowseSessionWithSignup,
} from '@/utils/analytics';
import type { MarketplaceBrowseStats } from '@/types/marketplace';

type ActiveSection = 'marketplace' | 'how-it-works';
type CtaType =
  | 'become_sponsor'
  | 'manage_events'
  | 'get_started'
  | 'learn_more';

export const SponsorshipPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sponsorModeEnabled } = useSponsorMode();
  const [activeSection, setActiveSection] =
    useState<ActiveSection>('marketplace');

  // Derived context
  const isAuthenticated = !!user;
  const isSponsor = sponsorModeEnabled;
  // For now, all authenticated users can act as organizers.
  const isOrganizer = isAuthenticated;

  // Track page visit and start browse session
  useEffect(() => {
    if (!isAuthenticated) {
      startBrowseSession();
    }

    return () => {
      if (!isAuthenticated) {
        clearBrowseSession();
      }
    };
  }, [isAuthenticated]);

  // Handle marketplace stats updates (real-time analytics)
  const handleMarketplaceStatsChange = useCallback(
    (stats: MarketplaceBrowseStats) => {
      trackMarketplaceBrowse({
        resultsCount: stats.resultsCount,
        searchQuery: stats.searchQuery,
        filtersApplied: stats.filtersApplied,
        source: 'sponsorship_page',
      });
    },
    []
  );

  // Handle CTA clicks with tracking + optional browse-session closeout
  const handleCTAClick = (type: CtaType, destination: string, redirectAfterAuth?: string) => {
    trackCTAClick({
      ctaType: type,
      source: 'hero',
      destination,
    });

    if (type === 'get_started' || type === 'become_sponsor') {
      endBrowseSessionWithSignup();
    }

    // If going to auth, pass redirect state
    if (destination === '/auth' && redirectAfterAuth) {
      navigate(destination, { state: { redirectTo: redirectAfterAuth } });
    } else {
      navigate(destination);
    }
  };

  const handleLearnMoreClick = () => {
    trackCTAClick({
      ctaType: 'learn_more',
      source: 'hero',
      destination: '/sponsorship#how-it-works',
    });
    setActiveSection('how-it-works');

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.getElementById('how-it-works');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-16 sm:pb-0">
      {/* Hero Header */}
      <header className="border-b bg-gradient-to-r from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="mx-auto max-w-5xl space-y-6 text-center">
            <Badge variant="brand" className="mb-1">
              <Sparkles className="mr-1 h-3 w-3" />
              Discover Opportunities
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Sponsorship Marketplace
            </h1>

            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              Connect brands with events, browse sponsorship packages, and see
              the performance behind every partnership.
            </p>

            {/* Role cards / CTAs */}
            <div className="mx-auto mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
              {/* Sponsor card */}
              <Card
                className={`border ${
                  isSponsor ? 'border-primary shadow-sm' : ''
                }`}
              >
                <CardContent className="flex h-full flex-col items-stretch gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">I'm a Sponsor</p>
                      <p className="text-xs text-muted-foreground">
                        Discover events and activate campaigns.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-auto"
                    onClick={() =>
                      handleCTAClick(
                        'become_sponsor',
                        isSponsor ? '/sponsor' : '/auth',
                        '/sponsor'
                      )
                    }
                  >
                    {isSponsor ? 'Go to Sponsor Dashboard' : 'Become a Sponsor'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Organizer card */}
              <Card
                className={`border ${
                  isOrganizer && !isSponsor ? 'border-primary shadow-sm' : ''
                }`}
              >
                <CardContent className="flex h-full flex-col items-stretch gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10">
                      <Users className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">
                        I'm an Event Organizer
                      </p>
                      <p className="text-xs text-muted-foreground">
                        List packages and manage sponsorships.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isOrganizer ? 'default' : 'outline'}
                    className="mt-auto"
                    onClick={() =>
                      handleCTAClick(
                        'manage_events',
                        isOrganizer ? '/dashboard' : '/auth',
                        '/dashboard'
                      )
                    }
                  >
                    {isOrganizer ? 'Manage My Events' : 'List My Event'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Secondary actions for unauthenticated */}
            {!isAuthenticated && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCTAClick('get_started', '/auth', '/sponsor')}
                >
                  Get Started
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLearnMoreClick}
                >
                  Learn More
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Compact Stats Bar */}
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-3">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-bold">$2.4M+</span>
                <span className="text-muted-foreground">in deals</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-bold">450+</span>
                <span className="text-muted-foreground">sponsors</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="font-bold">1,200+</span>
                <span className="text-muted-foreground">events</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="font-bold">82%</span>
                <span className="text-muted-foreground">match rate</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section switcher: Marketplace / How it works */}
        <section className="border-b bg-background">
          <div className="container mx-auto px-4 py-2">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
              <div className="hidden text-xs text-muted-foreground sm:block">
                Browse packages or learn how it works
              </div>
              <div className="inline-flex rounded-full border bg-muted/50 p-0.5 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setActiveSection('marketplace')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                    activeSection === 'marketplace'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background'
                  }`}
                >
                  <Search className="h-3 w-3" />
                  Marketplace
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('how-it-works')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                    activeSection === 'how-it-works'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background'
                  }`}
                >
                  <BarChart3 className="h-3 w-3" />
                  How it works
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 pb-20 pt-4 sm:pb-12">
          {activeSection === 'marketplace' ? (
            <div className="space-y-3">
              {/* Onboarding hint */}
              {!isAuthenticated && (
                <div className="mx-auto max-w-6xl">
                  <div className="flex items-start gap-2 rounded-lg bg-muted/70 p-2.5 text-xs sm:text-sm">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>
                        Browsing in guest mode.{' '}
                        <button
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() =>
                            handleCTAClick('get_started', '/auth', '/sponsor')
                          }
                        >
                          Sign up
                        </button>{' '}
                        to save favorites and track deals.
                      </p>
                  </div>
                </div>
              )}

              {/* Marketplace Grid (public mode, no sponsor context) */}
              <SponsorMarketplace
                sponsorId={isSponsor ? user?.id ?? null : null}
                onStatsChange={handleMarketplaceStatsChange}
              />
            </div>
          ) : (
            <div id="how-it-works" className="mx-auto max-w-4xl space-y-12">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold sm:text-2xl">
                  How It Works
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveSection('marketplace')}
                  className="self-start sm:self-auto"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Browse Packages
                </Button>
              </div>

              {/* For Sponsors */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold sm:text-xl">
                      For Sponsors
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Find the perfect events to reach your audience.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <Search className="mb-2 h-8 w-8 text-primary" />
                      <CardTitle className="text-lg">Discover</CardTitle>
                      <CardDescription>
                        Browse events with audience insights and package
                        details.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Target className="mb-2 h-8 w-8 text-primary" />
                      <CardTitle className="text-lg">Match</CardTitle>
                      <CardDescription>
                        Get recommendations based on your brand and goals.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <BarChart3 className="mb-2 h-8 w-8 text-primary" />
                      <CardTitle className="text-lg">Track</CardTitle>
                      <CardDescription>
                        Measure performance and ROI across all deals.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                <Button
                  size="lg"
                  className="w-full md:w-auto"
                  onClick={() =>
                    handleCTAClick(
                      'become_sponsor',
                      isSponsor ? '/sponsor' : '/auth',
                      '/sponsor'
                    )
                  }
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {isSponsor ? 'Go to Sponsor Dashboard' : 'Become a Sponsor'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* For Organizers */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold sm:text-xl">
                      For Event Organizers
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Monetize your events with the right sponsors.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <Zap className="mb-2 h-8 w-8 text-secondary" />
                      <CardTitle className="text-lg">Create Packages</CardTitle>
                      <CardDescription>
                        Build compelling sponsorship tiers with analytics
                        showcase.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Shield className="mb-2 h-8 w-8 text-secondary" />
                      <CardTitle className="text-lg">Secure Deals</CardTitle>
                      <CardDescription>
                        Escrow-backed payments and contract workflows.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CheckCircle2 className="mb-2 h-8 w-8 text-secondary" />
                      <CardTitle className="text-lg">Fulfill</CardTitle>
                      <CardDescription>
                        Track deliverables and build long-term relationships.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                <Button
                  size="lg"
                  className="w-full md:w-auto"
                  onClick={() =>
                    handleCTAClick(
                      'manage_events',
                      isOrganizer ? '/dashboard' : '/auth',
                      '/dashboard'
                    )
                  }
                >
                  <Users className="mr-2 h-4 w-4" />
                  {isOrganizer ? 'Manage My Events' : 'List Your Event'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Trust Signals */}
              <Card className="border-dashed bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardContent className="py-8">
                  <div className="grid gap-8 text-center md:grid-cols-3">
                    <div>
                      <Shield className="mx-auto mb-2 h-8 w-8 text-primary" />
                      <h4 className="mb-1 font-semibold">Secure Payments</h4>
                      <p className="text-sm text-muted-foreground">
                        Escrow-backed transactions with buyer protection.
                      </p>
                    </div>
                    <div>
                      <BarChart3 className="mx-auto mb-2 h-8 w-8 text-primary" />
                      <h4 className="mb-1 font-semibold">Full Transparency</h4>
                      <p className="text-sm text-muted-foreground">
                        Real analytics, verified attendance, honest metrics.
                      </p>
                    </div>
                    <div>
                      <Users className="mx-auto mb-2 h-8 w-8 text-primary" />
                      <h4 className="mb-1 font-semibold">Dedicated Support</h4>
                      <p className="text-sm text-muted-foreground">
                        Human support to help you close the right deals.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      </main>

      {/* Mobile sticky CTA bar */}
      {!isAuthenticated && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-2 shadow-lg backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex-1 text-xs">
              <p className="font-medium">Ready to get started?</p>
              <p className="text-[11px] text-muted-foreground">
                Create a free account to save deals and manage sponsorships.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleCTAClick('get_started', '/auth', '/sponsor')}
            >
              Get Started
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SponsorshipPage;
