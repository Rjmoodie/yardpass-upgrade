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
}

export default function OrganizationProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id, title, description, start_at, city, venue, cover_image_url, category')
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', org.id)
        .eq('visibility', 'public')
        .order('start_at', { ascending: true });

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
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <div className="relative">
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
        <div className="container max-w-4xl mx-auto px-4">
          <div className="-mt-10 md:-mt-12">
            <div className="inline-flex items-center gap-4 bg-card/90 backdrop-blur rounded-2xl border p-3 pr-5 shadow-lg">
              <Avatar className="w-20 h-20 ring-2 ring-background">
                <AvatarImage src={organization.logo_url || undefined} alt={organization.name} />
                <AvatarFallback className="text-xl">
                  <Building2 className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{organization.name}</h1>
                  {organization.verification_status === 'verified' && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {organization.handle && (
                    <span className="inline-flex items-center gap-1">
                      <AtSign className="w-4 h-4" />
                      {organization.handle}
                    </span>
                  )}
                  <span>Since {joinedYear}</span>
                  {organization.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {organization.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> {/* /HERO */}

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: About / Links */}
          <div className="space-y-6">
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
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
                  <CardTitle>Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {organization.website_url && (
                    <a
                      href={organization.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Globe className="w-4 h-4" /> {organization.website_url}
                    </a>
                  )}
                  {organization.twitter_url && (
                    <a
                      href={organization.twitter_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <LinkIcon className="w-4 h-4" /> {organization.twitter_url}
                    </a>
                  )}
                  {organization.instagram_url && (
                    <a
                      href={organization.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <LinkIcon className="w-4 h-4" /> {organization.instagram_url}
                    </a>
                  )}
                  {organization.tiktok_url && (
                    <a
                      href={organization.tiktok_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <LinkIcon className="w-4 h-4" /> {organization.tiktok_url}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Events */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Events</h2>
              <Badge variant="outline">{events.length}</Badge>
            </div>

            {events.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground text-center">
                    This organization hasn't created any public events yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleEventClick(event.id)}
                    role="button"
                    aria-label={`Open ${event.title}`}
                  >
                    {event.cover_image_url && (
                      <div className="aspect-video bg-muted overflow-hidden rounded-t-lg">
                        <ImageWithFallback
                          src={event.cover_image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">{event.title}</CardTitle>
                        {event.category && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0 hover:bg-muted cursor-pointer"
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

                    <CardContent>
                      {event.description && (
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(event.start_at).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {(event.venue || event.city) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{[event.venue, event.city].filter(Boolean).join(', ')}</span>
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
