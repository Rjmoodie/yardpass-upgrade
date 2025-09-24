import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfilePictureUpload } from '@/components/ProfilePictureUpload';
import { SocialLinkManager, SocialLink } from '@/components/SocialLinkManager';
import { SponsorModeSettings } from '@/components/sponsor/SponsorModeSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setPhotoUrl(profile.photo_url || '');
      // Parse social_links from JSON
      try {
        const profileWithSocial = profile as any;
        const links = Array.isArray(profileWithSocial.social_links) 
          ? profileWithSocial.social_links as SocialLink[]
          : [];
        setSocialLinks(links);
      } catch {
        setSocialLinks([]);
      }
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      toast({
        title: "Validation Error",
        description: "Display name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          display_name: displayName.trim(),
          photo_url: photoUrl || null,
          social_links: JSON.parse(JSON.stringify(socialLinks)) // Ensure it's proper JSON
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated",
      });

      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/profile')}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Edit Profile</h1>
          </div>
          
          <Button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Profile Picture Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfilePictureUpload
              currentPhotoUrl={photoUrl}
              displayName={displayName}
              onPhotoUpdate={setPhotoUrl}
              className="flex flex-col items-center"
            />
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ''}
                disabled
                className="mt-1 bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                type="text"
                value={profile.role === 'organizer' ? 'Organizer' : 'Attendee'}
                disabled
                className="mt-1 bg-muted capitalize"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Switch roles from your main profile page
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Social Links Section */}
        <SocialLinkManager
          socialLinks={socialLinks}
          onChange={setSocialLinks}
          maxLinks={3}
        />

        {/* Sponsor Mode Settings */}
        <SponsorModeSettings />

        {/* Privacy Note */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Privacy Note</p>
              <p>
                Your phone number and email are kept private and only visible to you. 
                Only your display name and profile picture are visible to other users.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}