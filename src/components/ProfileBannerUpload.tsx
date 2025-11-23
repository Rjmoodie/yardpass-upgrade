import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileBannerUploadProps {
  currentBannerUrl?: string | null;
  onBannerUpdate: (bannerUrl: string | null) => void;
  className?: string;
}

export function ProfileBannerUpload({ 
  currentBannerUrl, 
  onBannerUpdate,
  className = ""
}: ProfileBannerUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (8MB max for banners)
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 8MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create unique filename with user folder
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/banner-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(uploadData.path);

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ cover_photo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      onBannerUpdate(publicUrl);
      
      toast({
        title: "Banner updated",
        description: "Your profile banner has been successfully updated",
      });

    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBanner = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ cover_photo_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      onBannerUpdate(null);
      
      toast({
        title: "Banner removed",
        description: "Your profile banner has been removed",
      });
    } catch (error) {
      console.error('Error removing banner:', error);
      toast({
        title: "Remove failed",
        description: "Failed to remove banner. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {/* Banner Preview */}
      {currentBannerUrl ? (
        <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border bg-muted">
          <img
            src={currentBannerUrl}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleFileSelect}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Change Banner'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveBanner}
              disabled={uploading}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full h-48 rounded-lg border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center gap-3">
          <ImageIcon className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">No banner image</p>
            <p className="text-xs text-muted-foreground mb-3">Add a banner to personalize your profile</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFileSelect}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Banner'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Recommended: 1200x400px or larger. Max 8MB.
      </p>
    </div>
  );
}

