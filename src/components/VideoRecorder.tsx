import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Video, X, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface VideoRecorderProps {
  eventId: string;
  onClose: () => void;
  onSave: (videoBlob: Blob) => void;
}

const pickBestMime = () => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac', // some Chromium/Android builds
    'video/mp4',                 // last-ditch: many browsers won't allow this for MediaRecorder
  ];
  for (const c of candidates) {
    if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  // fall back to browser default
  return '';
};

export function VideoRecorder({ eventId, onClose, onSave }: VideoRecorderProps) {
  const [camera, setCamera] = useState<'front' | 'rear'>('rear');
  const [isRecording, setIsRecording] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [maxReached, setMaxReached] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  void eventId;

  // Own the stream lifecycle based on 'camera'
  useEffect(() => {
    let active = true;

    const startPreview = async () => {
      try {
        setPermissionError(null);
        // Try to get the "right" camera
        const constraints: MediaStreamConstraints = {
          audio: { echoCancellation: true, noiseSuppression: true },
          video: {
            facingMode: camera === 'rear' ? { ideal: 'environment' } : { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          // We switched again before this finished
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Autofocus/exposure/torch (best-effort)
        const [videoTrack] = stream.getVideoTracks();
        try {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' as any }, { exposureMode: 'continuous' as any }] as any,
          });
        } catch {}

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.setAttribute('x5-playsinline', 'true');
          videoRef.current.muted = true; // avoid echo during preview
          void videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        setPermissionError(err?.name === 'NotAllowedError'
          ? 'Camera or microphone access was blocked.'
          : 'Could not start camera.');
      }
    };

    // Start preview
    startPreview();

    return () => {
      active = false;
      // stop preview stream when switching camera/unmounting
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [camera]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) {
      toast({ title: 'Camera not ready', description: 'Please allow camera access and try again.', variant: 'destructive' });
      return;
    }
    try {
      setRecordedChunks([]);
      setMaxReached(false);
      setRecordingTime(0);

      const mimeType = pickBestMime();
      const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          setRecordedChunks((prev) => [...prev, ev.data]);
        }
      };
      mr.onstop = () => {
        // Keep preview off after stop; caller controls closing/saving
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
      mr.onerror = (e) => {
        toast({ title: 'Recorder error', description: String((e as any).error || e), variant: 'destructive' });
      };

      // Flush chunks every 400ms to keep memory low
      mr.start(400);
      setIsRecording(true);

      // Start recording time counter
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Optional max duration (e.g., 90s). Remove if not needed.
      const MAX_MS = 90_000;
      stopTimerRef.current = window.setTimeout(() => {
        setMaxReached(true);
        stopRecording();
      }, MAX_MS);
    } catch (error) {
      toast({ title: 'Unable to start recording', description: String(error), variant: 'destructive' });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

  const resetRecording = useCallback(() => {
    if (isRecording) stopRecording();
    setRecordedChunks([]);
    setMaxReached(false);
    setRecordingTime(0);
    // keep the preview stream alive; user may re-record
  }, [isRecording, stopRecording]);

  const saveVideo = useCallback(() => {
    if (!recordedChunks.length) return;
    const type =
      mediaRecorderRef.current?.mimeType ||
      recordedChunks[0].type ||
      'video/webm';
    const blob = new Blob(recordedChunks, { type });
    onSave(blob);
    setRecordedChunks([]);
  }, [recordedChunks, onSave]);

  const handleClose = useCallback(() => {
    if (isRecording) stopRecording();
    setRecordedChunks([]);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onClose();
  }, [isRecording, onClose, stopRecording]);

  // stop everything on unmount
  useEffect(() => {
    return () => {
      try { mediaRecorderRef.current?.stop(); } catch {}
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent p-4 pb-8">
          <Button 
            variant="ghost" 
            onClick={handleClose} 
            className="text-white hover:bg-white/10 rounded-full h-10 w-10 p-0"
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center">
            <h2 className="text-sm font-semibold text-white/90">Record Video</h2>
            {isRecording && (
              <div className="mt-1 flex items-center gap-1.5 text-red-500 font-mono text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {formatTime(recordingTime)}
              </div>
            )}
          </div>
          <Button
            onClick={() => setCamera((prev) => (prev === 'rear' ? 'front' : 'rear'))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 p-0"
            type="button"
            disabled={isRecording}
            title="Switch camera"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Preview */}
        <div className="relative flex-1 bg-black">
          <video 
            ref={videoRef} 
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          
          {/* Permission Error */}
          {permissionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="rounded-2xl bg-red-500/20 border border-red-500/50 px-6 py-4 text-center">
                <Camera className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-sm text-white font-medium">{permissionError}</p>
                <p className="text-xs text-white/60 mt-1">Check your browser permissions</p>
              </div>
            </div>
          )}
          
          {/* Max Duration Reached */}
          {maxReached && (
            <div className="absolute inset-x-0 top-4 mx-auto w-fit">
              <div className="rounded-full bg-yellow-500/90 px-4 py-2 text-xs font-medium text-black shadow-lg">
                Maximum duration reached (90s)
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent pt-8 pb-safe">
          <div className="space-y-4 px-4 pb-4">
            {/* Main Recording Button */}
            <div className="flex items-center justify-center gap-8">
              {recordedChunks.length > 0 && !isRecording && (
                <Button
                  onClick={resetRecording}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 ring-2 ring-white/20"
                  type="button"
                  title="Retake"
                >
                  <RotateCcw className="h-6 w-6" />
                </Button>
              )}
              
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 ring-4 ring-red-500/30' 
                    : 'bg-white text-black hover:scale-105 ring-4 ring-white/20'
                }`}
                type="button"
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? (
                  <div className="h-6 w-6 rounded-sm bg-white" />
                ) : (
                  <Video className="h-8 w-8" />
                )}
              </Button>
              
              {recordedChunks.length > 0 && !isRecording && (
                <Button
                  onClick={saveVideo}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary hover:bg-primary/90 ring-2 ring-primary/30"
                  type="button"
                  title="Use Video"
                >
                  <Check className="h-6 w-6 text-primary-foreground" />
                </Button>
              )}
            </div>

            {/* Status Text */}
            <div className="text-center">
              {isRecording ? (
                <p className="text-xs text-white/70">Tap the square to stop recording</p>
              ) : recordedChunks.length > 0 ? (
                <p className="text-xs text-white/70">Tap ✓ to use video or ↻ to retake</p>
              ) : (
                <p className="text-xs text-white/70">Tap the circle to start recording</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoRecorder;