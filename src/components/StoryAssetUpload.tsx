import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useMuxStoryUpload } from "@/hooks/useMuxStoryUpload";
import { Upload, Video, Image, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoryAssetUploadProps {
  eventId: string;
  onUploadComplete?: (playbackId: string) => void;
}

export default function StoryAssetUpload({ eventId, onUploadComplete }: StoryAssetUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"story_video" | "link_video">("story_video");
  const { upload, progress, status, playbackId, error, reset } = useMuxStoryUpload();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        reset();
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a video file",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const resultPlaybackId = await upload(selectedFile, eventId, uploadType);
      
      toast({
        title: "Upload successful!",
        description: "Your story video is ready for sharing",
      });
      
      onUploadComplete?.(resultPlaybackId);
      
    } catch (err) {
      toast({
        title: "Upload failed",
        description: error || "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video size={20} />
          Story Video Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Type Selection */}
        <div className="space-y-2">
          <Label>Video Purpose</Label>
          <div className="flex gap-2">
            <Button
              variant={uploadType === "story_video" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadType("story_video")}
            >
              Instagram Stories
            </Button>
            <Button
              variant={uploadType === "link_video" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadType("link_video")}
            >
              Link Shares
            </Button>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="video-upload">Video File</Label>
          <Input
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={status === "uploading" || status === "processing"}
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
        </div>

        {/* Upload Progress */}
        {status !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {status === "creating" && "Creating upload..."}
                {status === "uploading" && "Uploading..."}
                {status === "processing" && "Processing video..."}
                {status === "done" && "Upload complete!"}
                {status === "error" && "Upload failed"}
              </span>
              {status === "done" && <Check className="text-green-500" size={16} />}
              {status === "error" && <AlertCircle className="text-destructive" size={16} />}
            </div>
            
            {(status === "uploading" || status === "processing") && (
              <Progress value={progress} className="w-full" />
            )}
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* Video Preview */}
        {playbackId && status === "done" && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <video
              src={`https://stream.mux.com/${playbackId}/medium.mp4`}
              controls
              muted
              className="w-full max-h-48 rounded-lg"
              style={{ aspectRatio: '9 / 16', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || status === "uploading" || status === "processing"}
          className="w-full"
        >
          {status === "uploading" || status === "processing" ? (
            "Processing..."
          ) : (
            <>
              <Upload className="mr-2" size={16} />
              Upload Story Video
            </>
          )}
        </Button>

        {/* Guidelines */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Keep videos under 15 seconds for best performance</p>
          <p>• Use 9:16 aspect ratio (vertical) for Stories</p>
          <p>• Videos are automatically muted for autoplay</p>
        </div>
      </CardContent>
    </Card>
  );
}