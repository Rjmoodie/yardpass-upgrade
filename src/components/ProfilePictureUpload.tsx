import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { YardpassSpinner } from '@/components/LoadingSpinner';

interface ProfilePictureUploadProps {
  currentPhotoUrl?: string;
  displayName: string;
  onPhotoUpdate: (photoUrl: string) => void;
  className?: string;
}

export function ProfilePictureUpload({ 
  currentPhotoUrl, 
  displayName, 
  onPhotoUpdate,
  className = ""
}: ProfilePictureUploadProps) {
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create unique filename with user folder
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

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
        .update({ photo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      onPhotoUpdate(publicUrl);
      
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been successfully updated",
      });

    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload profile picture. Please try again.",
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

  const handleRemovePhoto = async () => {
    if (!user) return;

    setUploading(true);

    try {
      // Update user profile to remove photo
      const { error } = await supabase
        .from('user_profiles')
        .update({ photo_url: null })
        .eq('user_id', user.id);

      if (error) throw error;

      onPhotoUpdate('');
      
      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed",
      });

    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast({
        title: "Failed to remove photo",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative group">
        <Avatar className="w-24 h-24 mx-auto border-4 border-background shadow-lg">
          <AvatarImage src={currentPhotoUrl} alt={displayName} />
          <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-accent/20">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        {/* Upload overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFileSelect}
              disabled={uploading}
              className="h-8 w-8 p-0 rounded-full"
            >
              {uploading ? (
                <YardpassSpinner size="xs" showGlow={false} />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </Button>
            
            {currentPhotoUrl && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemovePhoto}
                disabled={uploading}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload button for mobile/accessibility */}
      <div className="mt-4 flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleFileSelect}
          disabled={uploading}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Change Photo'}
        </Button>
        
        {currentPhotoUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemovePhoto}
            disabled={uploading}
            className="text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}