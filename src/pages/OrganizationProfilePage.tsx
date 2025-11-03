// src/pages/OrganizationProfilePage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Building2, Shield, Calendar, MapPin, Share2, Image as ImageIcon, Globe, AtSign, Link as LinkIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { updateMetaTags } from '@/utils/meta';
import { useAuth } from '@/contexts/AuthContext';
import { FollowStats } from '@/components/follow/FollowStats';
import { FollowButton } from '@/components/follow/FollowButton';
import { FlashbackBadge } from '@/components/flashbacks/FlashbackBadge';

interface Organization {
  id: string;
  name: string;
  handle: string | null;
  logo_url: string | null;
  banner_url?: string | null;       // NEW (optional column)
  description?: string | null;      // NEW (optional column)
  website_url?: string | null;      // NEW (optional column)
  twitter_url?: string | null;      // NEW (optional column)
  instagram_url?: string | null;    // NEW (optional column)
  tiktok_url?: string | null;       // NEW (optional column)
  location?: string | null;         // NEW (optional column)
  verification_status: 'none' | 'pending' | 'verified' | 'pro';
  created_at: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  city: string | null;
  venue: string | null;
  cover_image_url: string | null;
  category: string | null;
  is_flashback?: boolean;
}

export default function OrganizationProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');

  // Admin / Branding modal state
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state for branding
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    description: '',
    website_url: '',
    twitter_url: '',
    instagram_url: '',
    tiktok_url: '',
    location: '',
  });

  // Build a canonical share URL
  const shareUrl = useMemo(() => {
    if (!organization) return window.location.href;
    const path = `/org/${organization.handle || organization.id}`;
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://yardpass.com';
      return new URL(path, base).toString();
    } catch {
      return path;
    }
  }, [organization]);

  // Split events into upcoming and past
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: Event[] = [];
    const past: Event[] = [];

    events.forEach(event => {
      const eventDate = new Date(event.start_at);
      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events]);

  // Get displayed events based on active tab
  const displayedEvents = useMemo(() => {
    return eventTab === 'upcoming' ? upcomingEvents : pastEvents;
  }, [eventTab, upcomingEvents, pastEvents]);

  useEffect(() => {
    if (!id) return;
    fetchOrganizationData();
  }, [id]);

  useEffect(() => {
    if (!organization) return;
    updateMetaTags({
      title: `${organization.name} • YardPass`,
      description:
        organization.description ||
        (organization.handle
          ? `@${organization.handle} on YardPass — view events and details.`
          : `View ${organization.name} on YardPass.`),
      url: shareUrl,
      type: 'website',
      image: organization.banner_url || organization.logo_url || undefined,
    });
  }, [organization, shareUrl]);

  // Check membership: simple owner/admin gate
  const checkIsAdmin = useCallback(async (orgId: string) => {
    if (!user?.id) return false;
    // Use org_memberships table with proper column names
    const { data, error } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .limit(1);
    if (error) return false;
    const role = data?.[0]?.role;
    return role === 'owner' || role === 'admin';
  }, [user?.id]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);

      // Check if id is UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
      
      // Fetch organization details - try by id first, then by handle
      let org, orgError;
      if (isUUID) {
        const result = await supabase
          .from('organizations')
          .select('*')
          .eq('id', id)
          .single();
        org = result.data;
        orgError = result.error;
      } else {
        // Try to find by handle
        const result = await supabase
          .from('organizations')
          .select('*')
          .eq('handle', id)
          .single();
        org = result.data;
        orgError = result.error;
      }

      if (orgError) throw orgError;
      setOrganization(org);

      if (org) {
        // preload form state
        setForm({
          description: org.description || '',
          website_url: org.website_url || '',
          twitter_url: org.twitter_url || '',
          instagram_url: org.instagram_url || '',
          tiktok_url: org.tiktok_url || '',
          location: org.location || '',
        });

        // admin?
        const ok = await checkIsAdmin(org.id);
        setIsAdmin(ok);
      }

      // Fetch organization's public events using the actual org id
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, description, start_at, city, venue, cover_image_url, category, is_flashback')
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', org.id)
        .eq('visibility', 'public')
        .order('start_at', { ascending: true});

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load organization.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (eventId: string) => {
    navigate(routes.event(eventId));
  };

  const handleShare = async () => {
    try {
      const title = organization?.name || 'Organization';
      const text = organization?.handle
        ? `Check out @${organization.handle} on YardPass`
        : `Check out ${organization?.name} on YardPass`;

      if ((navigator as any)?.share) {
        await (navigator as any).share({ title, text, url: shareUrl });
        toast({ title: 'Link shared' });
        return;
      }

      try {
        const [{ sharePayload }, { buildShareUrl, getShareTitle, getShareText }] = await Promise.all([
          import('@/lib/share'),
          import('@/lib/shareLinks'),
        ]);
        const shareTarget = {
          type: 'org' as const,
          slug: organization?.handle || organization?.id || '',
          name: organization?.name || '',
        };
        await sharePayload({
          title: getShareTitle(shareTarget),
          text: getShareText(shareTarget),
          url: buildShareUrl(shareTarget),
        });
        toast({ title: 'Link shared' });
        return;
      } catch {
        // fall through to clipboard
      }

      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied', description: 'URL copied to clipboard.' });
    } catch {
      toast({
        title: 'Share failed',
        description: 'Could not share the organization link.',
        variant: 'destructive',
      });
    }
  };

  // ---- Branding save ----
  const uploadImage = async (file: File, keyPrefix: string) => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${keyPrefix}-${Date.now()}.${ext}`;
    const path = `${organization!.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('org-media')
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('org-media').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSaveBranding = async () => {
    if (!organization) return;

    // Basic validation
    const allImagesOk =
      (!logoFile || logoFile.type.startsWith('image/')) &&
      (!bannerFile || bannerFile.type.startsWith('image/'));
    if (!allImagesOk) {
      toast({ title: 'Invalid file', description: 'Only image files are allowed.', variant: 'destructive' });
      return;
    }
    const tooBig =
      (logoFile && logoFile.size > 5 * 1024 * 1024) ||
      (bannerFile && bannerFile.size > 8 * 1024 * 1024);
    if (tooBig) {
      toast({ title: 'File too large', description: 'Max 5MB (logo) / 8MB (banner).', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let logo_url = organization.logo_url || null;
      let banner_url = organization.banner_url || null;

      if (logoFile) {
        logo_url = await uploadImage(logoFile, 'logo');
      }
      if (bannerFile) {
        banner_url = await uploadImage(bannerFile, 'banner');
      }

      const payload = {
        logo_url,
        banner_url,
        description: form.description?.trim() || null,
        website_url: form.website_url?.trim() || null,
        twitter_url: form.twitter_url?.trim() || null,
        instagram_url: form.instagram_url?.trim() || null,
        tiktok_url: form.tiktok_url?.trim() || null,
        location: form.location?.trim() || null,
      };

      const { error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', organization.id);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Branding updated successfully.' });
      setBrandingOpen(false);

      // refresh local state
      setOrganization((prev) => (prev ? { ...prev, ...payload } : prev));
      // reset files
      setLogoFile(null);
      setBannerFile(null);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message || 'Could not save branding.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <div className="h-3 w-40 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Organization Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The organization you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  // ---- Hero helpers ----
  const joinedYear = new Date(organization.created_at).getFullYear();
  const showBanner = !!organization.banner_url;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* HERO */}
      <div className="relative w-full">
        <div className="w-full h-48 sm:h-60 md:h-72 lg:h-80 bg-muted overflow-hidden">
          {showBanner ? (
            <ImageWithFallback
              src={organization.banner_url!}
              alt={`${organization.name} banner`}
              className="w-full h-full object-cover"
              fetchPriority="high"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/20 to-background" />
          )}
        </div>

        {/* Gradient overlay for contrast */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />

        {/* Back + Share + Edit controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBrandingOpen(true)}
                className="bg-black/40 border border-white/20 text-white hover:bg-black/60"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Edit branding
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              className="bg-black/40 border border-white/20 text-white hover:bg-black/60"
              aria-label="Share organization"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Logo card overlays the banner */}
        <div className="container max-w-4xl mx-auto px-3 sm:px-4">
          <div className="-mt-10 md:-mt-12">
            {/* Responsive: Stack on mobile, side-by-side on tablet+ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-card/90 backdrop-blur rounded-2xl border p-3 sm:p-4 shadow-lg w-full max-w-full overflow-hidden">
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 ring-2 ring-background shrink-0">
                <AvatarImage src={organization.logo_url || undefined} alt={organization.name} />
                <AvatarFallback className="text-lg sm:text-xl">
                  <Building2 className="w-6 h-6 sm:w-8 sm:h-8" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 w-full">
                {/* Name + Badge */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{organization.name}</h1>
                  {organization.verification_status === 'verified' && (
                    <Badge variant="brand" size="sm" className="shrink-0">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>

                {/* Metadata: Handle, Year, Location */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap mb-3">
                  {organization.handle && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <AtSign className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="truncate max-w-[120px] sm:max-w-none">{organization.handle}</span>
                    </span>
                  )}
                  <span className="shrink-0">Since {joinedYear}</span>
                  {organization.location && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="truncate max-w-[150px] sm:max-w-none">{organization.location}</span>
                    </span>
                  )}
                </div>

                {/* Stats + Actions - Stack on small screens */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <FollowStats
                    targetType="organizer"
                    targetId={organization.id}
                    enablePendingReview={isAdmin}
                  />
                  <FollowButton targetType="organizer" targetId={organization.id} size="default" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> {/* /HERO */}

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: About / Links */}
          <div className="space-y-4 sm:space-y-6">
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">About</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                {organization.description
                  ? organization.description
                  : 'This organizer has not added a description yet.'}
              </CardContent>
            </Card>

            {/* Links */}
            {(organization.website_url ||
              organization.twitter_url ||
              organization.instagram_url ||
              organization.tiktok_url) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {organization.website_url && (
                    <a
                      href={organization.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline min-w-0"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      <span className="truncate">{organization.website_url}</span>
                    </a>
                  )}
                  {organization.twitter_url && (
                    <a
                      href={organization.twitter_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline min-w-0"
                    >
                      <LinkIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{organization.twitter_url}</span>
                    </a>
                  )}
                  {organization.instagram_url && (
                    <a
                      href={organization.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline min-w-0"
                    >
                      <LinkIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{organization.instagram_url}</span>
                    </a>
                  )}
                  {organization.tiktok_url && (
                    <a
                      href={organization.tiktok_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline min-w-0"
                    >
                      <LinkIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{organization.tiktok_url}</span>
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Events */}
          <div className="lg:col-span-2 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                <h2 className="text-lg sm:text-xl font-semibold">Events</h2>
                <Badge variant="neutral" size="sm">{events.length}</Badge>
              </div>
              
              {/* Event Tabs */}
              {events.length > 0 && (
                <div className="flex items-center gap-2 bg-muted/30 rounded-full p-1">
                  <button
                    onClick={() => setEventTab('upcoming')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                      eventTab === 'upcoming'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    Upcoming ({upcomingEvents.length})
                  </button>
                  <button
                    onClick={() => setEventTab('past')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                      eventTab === 'past'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    Past ({pastEvents.length})
                  </button>
                </div>
              )}
            </div>

            {displayedEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {eventTab === 'upcoming' ? 'No Upcoming Events' : 'No Past Events'}
                  </h3>
                  <p className="text-muted-foreground text-center text-sm">
                    {eventTab === 'upcoming' 
                      ? 'This organization has no scheduled events at the moment.'
                      : 'This organization has no past events.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {displayedEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => handleEventClick(event.id)}
                    role="button"
                    aria-label={`Open ${event.title}`}
                  >
                    {event.cover_image_url && (
                      <div className="aspect-video bg-muted overflow-hidden relative">
                        <ImageWithFallback
                          src={event.cover_image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        {event.is_flashback && (
                          <div className="absolute top-3 left-3">
                            <FlashbackBadge variant="default" className="text-sm px-3 py-1.5 shadow-xl" />
                          </div>
                        )}
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex-1 min-w-0 space-y-2">
                          <CardTitle className="text-base sm:text-lg line-clamp-2 min-w-0 break-words">{event.title}</CardTitle>
                          {/* Show Flashback badge in header if no cover image */}
                          {event.is_flashback && !event.cover_image_url && (
                            <FlashbackBadge variant="minimal" className="text-xs px-2 py-0.5" />
                          )}
                        </div>
                        {event.category && (
                          <Badge
                            variant="neutral"
                            size="sm"
                            className="text-[10px] shrink-0 hover:bg-muted cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(routes.category(event.category!));
                            }}
                            aria-label={`View ${event.category} events`}
                          >
                            {event.category}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {event.description && (
                        <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-2 break-words">
                          {event.description}
                        </p>
                      )}
                      <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                        <div className="flex items-start gap-2 text-muted-foreground min-w-0">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5" />
                          <span className="break-words">
                            {new Date(event.start_at).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {(event.venue || event.city) && (
                          <div className="flex items-start gap-2 text-muted-foreground min-w-0">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5" />
                            <span className="truncate">{[event.venue, event.city].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branding Dialog (Admin only) */}
      <Dialog open={brandingOpen} onOpenChange={setBrandingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Organization Branding</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-6">
            {/* Banner */}
            <div>
              <label className="text-sm font-medium">Banner</label>
              <div className="mt-2 border rounded-lg overflow-hidden">
                <div className="h-36 bg-muted relative">
                  {bannerFile ? (
                    // preview selected
                    <img
                      src={URL.createObjectURL(bannerFile)}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                  ) : organization.banner_url ? (
                    <img
                      src={organization.banner_url}
                      alt="Banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary/20 to-background" />
                  )}
                  <div className="absolute inset-0 flex items-end justify-end p-2 gap-2">
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                    {bannerFile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBannerFile(null)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="text-sm font-medium">Logo</label>
              <div className="mt-2 flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  {logoFile ? (
                    <img
                      src={URL.createObjectURL(logoFile)}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <AvatarImage src={organization.logo_url || undefined} />
                      <AvatarFallback>
                        <Building2 className="w-6 h-6" />
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                  <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  {logoFile && (
                    <Button variant="ghost" size="sm" onClick={() => setLogoFile(null)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                className="mt-2"
                placeholder="Tell people what your organization is about..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={5}
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                className="mt-2"
                placeholder="City, Country"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Website</label>
                <Input
                  className="mt-2"
                  placeholder="https://example.com"
                  value={form.website_url}
                  onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Twitter / X</label>
                <Input
                  className="mt-2"
                  placeholder="https://twitter.com/yourhandle"
                  value={form.twitter_url}
                  onChange={(e) => setForm((f) => ({ ...f, twitter_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Instagram</label>
                <Input
                  className="mt-2"
                  placeholder="https://instagram.com/yourhandle"
                  value={form.instagram_url}
                  onChange={(e) => setForm((f) => ({ ...f, instagram_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">TikTok</label>
                <Input
                  className="mt-2"
                  placeholder="https://tiktok.com/@yourhandle"
                  value={form.tiktok_url}
                  onChange={(e) => setForm((f) => ({ ...f, tiktok_url: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setBrandingOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveBranding} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
