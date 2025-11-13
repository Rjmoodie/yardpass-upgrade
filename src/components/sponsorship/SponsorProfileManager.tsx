// Sponsor Profile Manager - Complete sponsor profile management
// Handles profile creation, updates, team management, and public profile

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Building2, 
  Users, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Star, 
  Edit, 
  Save, 
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { sponsorshipClient, formatCurrency } from '@/integrations/supabase/sponsorship-client';
import type { 
  SponsorComplete, 
  SponsorPublicProfile, 
  SponsorMember,
  CreateSponsorRequest,
  UpdateSponsorProfileRequest 
} from '@/types/sponsorship-complete';

interface SponsorProfileManagerProps {
  sponsorId?: string;
  onSave?: (sponsor: SponsorComplete) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit' | 'view';
}

export const SponsorProfileManager: React.FC<SponsorProfileManagerProps> = ({
  sponsorId,
  onSave,
  onCancel,
  mode = 'edit'
}) => {
  const [sponsor, setSponsor] = useState<SponsorComplete | null>(null);
  const [publicProfile, setPublicProfile] = useState<SponsorPublicProfile | null>(null);
  const [members, setMembers] = useState<SponsorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Form states
  const [formData, setFormData] = useState<CreateSponsorRequest>({
    name: '',
    logo_url: '',
    website_url: '',
    contact_email: '',
    industry: '',
    company_size: '',
    brand_values: {},
    preferred_visibility_options: {}
  });

  const [profileData, setProfileData] = useState<UpdateSponsorProfileRequest>({
    industry: '',
    company_size: '',
    annual_budget_cents: null,
    brand_objectives: {},
    target_audience: {},
    preferred_categories: [],
    regions: [],
    activation_preferences: {},
    case_studies: {},
    preferred_formats: []
  });

  const [publicProfileData, setPublicProfileData] = useState({
    slug: '',
    headline: '',
    about: '',
    brand_values: {},
    badges: [] as string[],
    social_links: [] as Record<string, unknown>[]
  });

  // Load sponsor data
  useEffect(() => {
    if (sponsorId && mode !== 'create') {
      loadSponsorData();
    } else {
      setLoading(false);
    }
  }, [sponsorId, mode]);

  const loadSponsorData = async () => {
    try {
      setLoading(true);
      const response = await sponsorshipClient.getSponsor(sponsorId!);
      
      if (response.success && response.data) {
        const sponsorData = response.data;
        setSponsor(sponsorData);
        
        // Populate form data
        setFormData({
          name: sponsorData.name,
          logo_url: sponsorData.logo_url || '',
          website_url: sponsorData.website_url || '',
          contact_email: sponsorData.contact_email || '',
          industry: sponsorData.industry || '',
          company_size: sponsorData.company_size || '',
          brand_values: sponsorData.brand_values || {},
          preferred_visibility_options: sponsorData.preferred_visibility_options || {}
        });

        // Load profile data if exists
        if (sponsorData.sponsor_profiles?.[0]) {
          const profile = sponsorData.sponsor_profiles[0];
          setProfileData({
            industry: profile.industry || '',
            company_size: profile.company_size || '',
            annual_budget_cents: profile.annual_budget_cents,
            brand_objectives: profile.brand_objectives || {},
            target_audience: profile.target_audience || {},
            preferred_categories: profile.preferred_categories || [],
            regions: profile.regions || [],
            activation_preferences: profile.activation_preferences || {},
            case_studies: sponsorData.case_studies || {},
            preferred_formats: sponsorData.preferred_formats || []
          });
        }

        // Load public profile if exists
        if (sponsorData.sponsor_public_profiles?.[0]) {
          const publicProf = sponsorData.sponsor_public_profiles[0];
          setPublicProfile(publicProf);
          setPublicProfileData({
            slug: publicProf.slug,
            headline: publicProf.headline || '',
            about: publicProf.about || '',
            brand_values: publicProf.brand_values || {},
            badges: publicProf.badges || [],
            social_links: publicProf.social_links || []
          });
        }

        // Load members
        if (sponsorData.sponsor_members) {
          setMembers(sponsorData.sponsor_members);
        }
      } else {
        setError(response.error || 'Failed to load sponsor data');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading sponsor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (mode === 'create') {
        const response = await sponsorshipClient.createSponsor(formData);
        if (response.success && response.data) {
          onSave?.(response.data);
        } else {
          setError(response.error || 'Failed to create sponsor');
        }
      } else if (sponsorId) {
        // Update existing sponsor
        const response = await sponsorshipClient.updateSponsorProfile(sponsorId, profileData);
        if (response.success && response.data) {
          onSave?.(response.data);
        } else {
          setError(response.error || 'Failed to update sponsor');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error saving sponsor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field: keyof CreateSponsorRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileChange = (field: keyof UpdateSponsorProfileRequest, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePublicProfileChange = (field: string, value: any) => {
    setPublicProfileData(prev => ({ ...prev, [field]: value }));
  };

  const addSocialLink = () => {
    setPublicProfileData(prev => ({
      ...prev,
      social_links: [...prev.social_links, { platform: '', url: '' }]
    }));
  };

  const removeSocialLink = (index: number) => {
    setPublicProfileData(prev => ({
      ...prev,
      social_links: prev.social_links.filter((_, i) => i !== index)
    }));
  };

  const updateSocialLink = (index: number, field: string, value: string) => {
    setPublicProfileData(prev => ({
      ...prev,
      social_links: prev.social_links.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {mode === 'create' ? 'Create Sponsor Profile' : 'Manage Sponsor Profile'}
        </h1>
        <p className="text-muted-foreground">
          {mode === 'create' 
            ? 'Set up your sponsor profile to start connecting with events'
            : 'Manage your sponsor profile and team settings'
          }
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          <TabsTrigger value="public">Public Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Enter company name"
                    disabled={mode === 'view'}
                  />
                </div>

                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleFormChange('industry', value)}
                    disabled={mode === 'view'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="nonprofit">Non-profit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="company_size">Company Size</Label>
                  <Select
                    value={formData.company_size}
                    onValueChange={(value) => handleFormChange('company_size', value)}
                    disabled={mode === 'view'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startup">Startup (1-10)</SelectItem>
                      <SelectItem value="small">Small (11-50)</SelectItem>
                      <SelectItem value="medium">Medium (51-200)</SelectItem>
                      <SelectItem value="large">Large (201-1000)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleFormChange('contact_email', e.target.value)}
                    placeholder="contact@company.com"
                    disabled={mode === 'view'}
                  />
                </div>

                <div>
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => handleFormChange('website_url', e.target.value)}
                    placeholder="https://company.com"
                    disabled={mode === 'view'}
                  />
                </div>

                <div>
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => handleFormChange('logo_url', e.target.value)}
                    placeholder="https://company.com/logo.png"
                    disabled={mode === 'view'}
                  />
                </div>
              </div>

              {formData.logo_url && (
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={formData.logo_url} alt={formData.name} />
                    <AvatarFallback>
                      {formData.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">Logo Preview</p>
                    <p className="text-xs text-muted-foreground">
                      Make sure your logo is square and at least 200x200px
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Details Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sponsorship Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="annual_budget">Annual Sponsorship Budget</Label>
                  <Input
                    id="annual_budget"
                    type="number"
                    value={profileData.annual_budget_cents ? profileData.annual_budget_cents / 100 : ''}
                    onChange={(e) => handleProfileChange('annual_budget_cents', 
                      e.target.value ? parseInt(e.target.value) * 100 : null
                    )}
                    placeholder="50000"
                    disabled={mode === 'view'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This helps us match you with appropriate events
                  </p>
                </div>

                <div>
                  <Label>Preferred Categories</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['Technology', 'Sports', 'Music', 'Business', 'Education'].map((category) => (
                      <Badge
                        key={category}
                        variant={profileData.preferred_categories?.includes(category.toLowerCase()) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (mode === 'view') return;
                          const current = profileData.preferred_categories || [];
                          const updated = current.includes(category.toLowerCase())
                            ? current.filter(c => c !== category.toLowerCase())
                            : [...current, category.toLowerCase()];
                          handleProfileChange('preferred_categories', updated);
                        }}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="brand_objectives">Brand Objectives</Label>
                <Textarea
                  id="brand_objectives"
                  value={JSON.stringify(profileData.brand_objectives, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleProfileChange('brand_objectives', parsed);
                    } catch {
                      // Invalid JSON, keep the text
                    }
                  }}
                  placeholder="Describe your brand objectives and goals..."
                  rows={4}
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <Label htmlFor="target_audience">Target Audience</Label>
                <Textarea
                  id="target_audience"
                  value={JSON.stringify(profileData.target_audience, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleProfileChange('target_audience', parsed);
                    } catch {
                      // Invalid JSON, keep the text
                    }
                  }}
                  placeholder="Describe your target audience..."
                  rows={4}
                  disabled={mode === 'view'}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Public Profile Tab */}
        <TabsContent value="public" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <p className="text-sm text-muted-foreground">
                This information will be visible to event organizers
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug">Profile Slug</Label>
                  <Input
                    id="slug"
                    value={publicProfileData.slug}
                    onChange={(e) => handlePublicProfileChange('slug', e.target.value)}
                    placeholder="company-name"
                    disabled={mode === 'view'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your public profile URL: liventix.com/sponsors/{publicProfileData.slug}
                  </p>
                </div>

                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={publicProfileData.headline}
                    onChange={(e) => handlePublicProfileChange('headline', e.target.value)}
                    placeholder="Leading technology company"
                    disabled={mode === 'view'}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="about">About</Label>
                <Textarea
                  id="about"
                  value={publicProfileData.about}
                  onChange={(e) => handlePublicProfileChange('about', e.target.value)}
                  placeholder="Tell event organizers about your company..."
                  rows={4}
                  disabled={mode === 'view'}
                />
              </div>

              <div>
                <Label>Social Links</Label>
                <div className="space-y-2">
                  {publicProfileData.social_links.map((link, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="Platform (e.g., LinkedIn, Twitter)"
                        value={link.platform as string || ''}
                        onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                        disabled={mode === 'view'}
                      />
                      <Input
                        placeholder="URL"
                        value={link.url as string || ''}
                        onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                        disabled={mode === 'view'}
                      />
                      {mode !== 'view' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeSocialLink(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {mode !== 'view' && (
                    <Button variant="outline" onClick={addSocialLink} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Social Link
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Team Members</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {member.user_id.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">User {member.user_id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Role: {member.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{member.role}</Badge>
                      {mode !== 'view' && (
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No team members yet</p>
                    <p className="text-sm">Invite team members to collaborate</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {mode !== 'view' && (
        <div className="flex justify-end space-x-4 mt-8">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Create Profile' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SponsorProfileManager;
