import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Video as VideoIcon, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  X,
  RotateCcw
} from 'lucide-react';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (file: File) => void;
}

export function RecordingModal({ isOpen, onClose, onRecordingComplete }: RecordingModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recordingType, setRecordingType] = useState<'video' | 'audio'>('video');
  
  const {
    isRecording,
    isPaused,
    duration,
    error,
    stream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording
  } = useMediaRecorder();

  // Display live video feed
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    startRecording(recordingType === 'video', true);
  };

  const handleStopRecording = async () => {
    try {
      const file = await stopRecording();
      onRecordingComplete(file);
      onClose();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      cancelRecording();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record {recordingType === 'video' ? 'Video' : 'Audio'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recording Type Selector */}
          {!isRecording && (
            <div className="flex gap-2">
              <Button
                variant={recordingType === 'video' ? 'default' : 'outline'}
                onClick={() => setRecordingType('video')}
                className="flex-1"
              >
                <VideoIcon className="w-4 h-4 mr-2" />
                Video
              </Button>
              <Button
                variant={recordingType === 'audio' ? 'default' : 'outline'}
                onClick={() => setRecordingType('audio')}
                className="flex-1"
              >
                <Mic className="w-4 h-4 mr-2" />
                Audio Only
              </Button>
            </div>
          )}

          {/* Video Preview */}
          {recordingType === 'video' && (
            <div className="relative bg-background rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video object-cover"
              />
              {isRecording && (
                <div className="absolute top-2 left-2">
                  <Badge variant="destructive" className="animate-pulse">
                    REC {formatDuration(duration)}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Audio Only Display */}
          {recordingType === 'audio' && (
            <div className="flex items-center justify-center bg-background rounded-lg p-8">
              <div className="text-center">
                <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    REC {formatDuration(duration)}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-2">
            {!isRecording ? (
              <Button onClick={handleStartRecording} disabled={!!error}>
                <VideoIcon className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button variant="outline" onClick={pauseRecording}>
                    <Pause className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="outline" onClick={resumeRecording}>
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                
                <Button onClick={handleStopRecording} variant="default">
                  <Square className="w-4 h-4 mr-2" />
                  Stop & Save
                </Button>
                
                <Button variant="outline" onClick={cancelRecording}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Help Text */}
          {!isRecording && (
            <p className="text-xs text-muted-foreground text-center">
              Your browser will ask for camera/microphone permission
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}