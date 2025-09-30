import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [videoDeviceId, setVideoDeviceId] = useState<string>('');
  const [audioDeviceId, setAudioDeviceId] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const {
    isSupported,
    permission,
    isRecording,
    isPaused,
    duration,
    error,
    stream,
    requestPermission,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  } = useMediaRecorder();

  // device lists
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        // enumerate requires a permission grant on some browsers to reveal labels
        if (permission !== 'granted') {
          await requestPermission({ video: true, audio: true });
        }
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
      } catch {}
    })();
  }, [isOpen, permission, requestPermission]);

  const cams = useMemo(() => devices.filter(d => d.kind === 'videoinput'), [devices]);
  const mics = useMemo(() => devices.filter(d => d.kind === 'audioinput'), [devices]);

  // Display live video feed
  useEffect(() => {
    if (videoRef.current && stream && recordingType === 'video') {
      // @ts-expect-error - srcObject exists in browsers
      videoRef.current.srcObject = stream;
    }
  }, [stream, recordingType]);

  const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
    };

  const handleStartRecording = async () => {
    await requestPermission({ video: recordingType === 'video', audio: true });
    startRecording(
      recordingType === 'video',
      true,
      {
        timesliceMs: 100,
        videoDeviceId: recordingType === 'video' && videoDeviceId ? videoDeviceId : undefined,
        audioDeviceId: audioDeviceId || undefined,
        videoFacingMode: 'user',
        maxDurationMs: 1000 * 60 * 15, // 15 min safety cap
      }
    );
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
    if (isRecording) cancelRecording();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSupported ? (
              <>Record {recordingType === 'video' ? 'Video' : 'Audio'}</>
            ) : (
              <>Recording not supported in this browser</>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recording Type Selector */}
          {!isRecording && (
            <div className="flex gap-2">
              <Button
                variant={recordingType === 'video' ? 'default' : 'outline'}
                onClick={() => setRecordingType('video')}
                className="flex-1"
                disabled={!isSupported}
              >
                <VideoIcon className="w-4 h-4 mr-2" />
                Video
              </Button>
              <Button
                variant={recordingType === 'audio' ? 'default' : 'outline'}
                onClick={() => setRecordingType('audio')}
                className="flex-1"
                disabled={!isSupported}
              >
                <Mic className="w-4 h-4 mr-2" />
                Audio Only
              </Button>
            </div>
          )}

          {/* Device pickers (optional) */}
          {!isRecording && isSupported && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recordingType === 'video' && (
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={videoDeviceId}
                  onChange={(e) => setVideoDeviceId(e.target.value)}
                >
                  <option value="">Default Camera</option>
                  {cams.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label || 'Camera'}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={audioDeviceId}
                onChange={(e) => setAudioDeviceId(e.target.value)}
              >
                <option value="">Default Microphone</option>
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || 'Microphone'}
                  </option>
                ))}
              </select>
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
                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <Badge variant="destructive" className="animate-pulse">
                    REC {formatDuration(duration)}
                  </Badge>
                  {permission !== 'granted' && (
                    <Badge variant="outline">Awaiting permission…</Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audio Only Display */}
          {recordingType === 'audio' && (
            <div className="flex items-center justify-center bg-background rounded-lg p-8">
              <div className="text-center">
                <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <div className="flex items-center justify-center gap-2">
                  {isRecording && (
                    <Badge variant="destructive" className="animate-pulse">
                      REC {formatDuration(duration)}
                    </Badge>
                  )}
                  {!isRecording && permission !== 'granted' && (
                    <Badge variant="outline">Mic permission required</Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {(error || !isSupported) && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error || 'Your browser does not support MediaRecorder.'}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-2">
            {!isRecording ? (
              <Button onClick={handleStartRecording} disabled={!isSupported}>
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
                
                <Button variant="outline" onClick={cancelRecording} title="Discard">
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Help Text */}
          {!isRecording && (
            <p className="text-xs text-muted-foreground text-center">
              {permission === 'granted'
                ? 'Ready to record.'
                : 'Your browser will ask for camera/microphone permission'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}