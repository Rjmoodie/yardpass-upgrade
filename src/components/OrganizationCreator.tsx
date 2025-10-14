// src/components/OrganizationCreator.tsx

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ArrowLeft, Upload, Users, Building2, Shield, Check, X, CreditCard } from 'lucide-react';
import { BrandedSpinner } from './BrandedSpinner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { StripeConnectOnboarding } from './StripeConnectOnboarding';
import { SocialLinkManager } from './SocialLinkManager';

interface OrganizationCreatorProps {
  onBack: () => void;
  onSuccess: (orgId: string) => void;
}

// Adjust to your storage bucket name (create one if needed)
const ORG_LOGOS_BUCKET = 'org-logos';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/@/g, '')
    .replace(/[^a-z0-9- ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
}

export function OrganizationCreator({ onBack, onSuccess }: OrganizationCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    description: '',
  });

  const [socialLinks, setSocialLinks] = useState<Array<{
    platform: string;
    url: string;
    is_primary: boolean;
  }>>([]);

  const handleRegexOk = useMemo(() => /^[a-z0-9-]{3,30}$/.test(formData.handle), [formData.handle]);
  const canSubmit = !!user && !!formData.name && !!formData.handle && handleRegexOk && handleAvailable !== false && !loading;

  // Debounced handle availability check
  useEffect(() => {
    if (!formData.handle || !handleRegexOk) {
      setHandleAvailable(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setCheckingHandle(true);
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id')
          .eq('handle', formData.handle)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error; // ignore "no rows" code if any driver returns it

        if (!cancelled) {
          setHandleAvailable(!data); // available if no row
        }
      } catch (e) {
        if (!cancelled) {
          setHandleAvailable(null);
          // keep quiet; user can still submit and rely on unique constraint
        }
      } finally {
        if (!cancelled) setCheckingHandle(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formData.handle, handleRegexOk]);

  const pickLogo = () => {
    fileInputRef.current?.click();
  };

  const onLogoChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] || null;
    setLogoFile(f || null);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const uploadLogoAndPatch = async (orgId: string) => {
    if (!logoFile) return null;

    // Pick an extension from mime type (fallback .png)
    const ext = (logoFile.type.split('/')[1] || 'png').toLowerCase();
    const path = `orgs/${orgId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(ORG_LOGOS_BUCKET)
      .upload(path, logoFile, { upsert: true, cacheControl: '3600' });

    if (upErr) {
      toast({
        title: 'Logo upload failed',
        description: 'Your org was created, but the logo could not be uploaded.',
        variant: 'destructive',
      });
      return null;
    }

    const { data: pub } = supabase.storage.from(ORG_LOGOS_BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    if (publicUrl) {
      const { error: patchErr } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', orgId);

      if (patchErr) {
        toast({
          title: 'Logo saved partially',
          description: 'Uploaded logo, but failed to attach to organization.',
          variant: 'destructive',
        });
      }
    }

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1) Create organization atomically w/ membership (no logo yet; we'll patch it right after)
      const { data: orgId, error } = await supabase.rpc('create_organization_with_membership', {
        p_name: formData.name.trim(),
        p_handle: formData.handle.trim(),
        p_logo_url: null, // will be patched after upload
        p_creator_id: user.id,
      });

      if (error) throw error;
      if (!orgId) throw new Error('Organization ID missing from RPC response');

      // 2) Update with description and social links
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          description: formData.description?.trim() || null,
          social_links: socialLinks,
        })
        .eq('id', orgId as string);

      if (updateError) {
        console.warn('Failed to update description/social links:', updateError);
      }

      // 3) Upload logo (optional) then patch
      await uploadLogoAndPatch(orgId as string);

      toast({
        title: 'Organization Created',
        description: 'Your organization has been created successfully!',
      });

      onSuccess(orgId as string);
    } catch (error: any) {
      let message = error?.message || 'Failed to create organization.';
      if (message.includes('organizations_handle_key')) {
        message = `The handle "@${formData.handle}" is already taken. Please choose a different one.`;
      }
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Create Organization</h1>
            <p className="text-sm text-muted-foreground">
              Set up your organization to manage events and team members
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* Organization Basics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="name">Organization Name *</label>
                <Input
                  id="name"
                  placeholder="Enter organization name"
                  value={formData.name}
                  onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                />
              </div>

              {/* Handle */}
              <div className="space-y-2">
                <label htmlFor="handle">Handle *</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">@</span>
                  <Input
                    id="handle"
                    placeholder="your-organization"
                    value={formData.handle}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, handle: slugify(e.target.value) }))
                    }
                  />
                  <div className="w-6 h-6 flex items-center justify-center">
                    {checkingHandle ? (
                      <BrandedSpinner size="sm" />
                    ) : handleAvailable === true ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : handleAvailable === false ? (
                      <X className="w-4 h-4 text-red-600" />
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>3–30 chars, letters/numbers/hyphens</span>
                  {!handleRegexOk && formData.handle && (
                    <span className="text-red-600">Invalid handle format</span>
                  )}
                  {handleAvailable === false && (
                    <span className="text-red-600">Handle is already taken</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description">Description</label>
                <Textarea
                  id="description"
                  placeholder="Tell people about your organization..."
                  value={formData.description}
                  onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
                  className="min-h-20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <Avatar className="w-16 h-16">
                  {logoPreviewUrl ? (
                    <AvatarImage src={logoPreviewUrl} alt="Logo preview" />
                  ) : (
                    <AvatarFallback className="text-lg">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : <Building2 className="w-8 h-8" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload a square logo (PNG/JPG, ≤ 5 MB)
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={pickLogo}>
                        Choose Logo
                      </Button>
                      {logoFile && (
                        <Badge variant="secondary" className="text-xs">
                          {logoFile.name}
                        </Badge>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={onLogoChange}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Links */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add social media links to help people connect with your organization
              </p>
            </CardHeader>
            <CardContent>
              <SocialLinkManager 
                socialLinks={socialLinks}
                onChange={setSocialLinks}
                maxLinks={3}
              />
            </CardContent>
          </Card>

          {/* Preview */}
          {(formData.name || formData.handle || formData.description) && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Avatar className="w-12 h-12">
                    {logoPreviewUrl ? (
                      <AvatarImage src={logoPreviewUrl} alt="Logo preview" />
                    ) : (
                      <AvatarFallback>
                        {formData.name ? formData.name.charAt(0).toUpperCase() : <Building2 className="w-5 h-5" />}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm">{formData.name || 'Organization name'}</h3>
                      <Badge variant="outline" className="text-xs">
                        @{formData.handle || 'handle'}
                      </Badge>
                    </div>
                    {formData.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {formData.description}
                      </p>
                    )}
                    {socialLinks.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {socialLinks.length} social link{socialLinks.length > 1 ? 's' : ''} added
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    Ready
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                <div>
                  <p className="text-sm">Invite team members with different roles</p>
                  <p className="text-xs text-muted-foreground">Admin, Editor, Scanner permissions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                <div>
                  <p className="text-sm">Complete business verification for payouts</p>
                  <p className="text-xs text-muted-foreground">Required for processing payments</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                <div>
                  <p className="text-sm">Create and manage events as a team</p>
                  <p className="text-xs text-muted-foreground">Collaborative event management</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-card p-4 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>

        <Button onClick={handleSubmit} disabled={!canSubmit} className="px-8">
          {loading ? (
            <>
              <BrandedSpinner size="sm" text="Creating..." />
            </>
          ) : (
            'Create Organization'
          )}
        </Button>
      </div>
    </div>
  );
}

export default OrganizationCreator;
