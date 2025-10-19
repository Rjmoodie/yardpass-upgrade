import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Video, X } from 'lucide-react';
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<number | null>(null);

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
      };
      mr.onerror = (e) => {
        toast({ title: 'Recorder error', description: String((e as any).error || e), variant: 'destructive' });
      };

      // Flush chunks every 400ms to keep memory low
      mr.start(400);
      setIsRecording(true);

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

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between bg-black/80 p-4">
          <Button variant="ghost" onClick={handleClose} className="text-white">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Record video</h2>
          <div className="w-10" />
        </div>

        <div className="relative flex-1 bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          {isRecording && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Recording
            </div>
          )}
          {permissionError && (
            <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              {permissionError}
            </div>
          )}
          {maxReached && (
            <div className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-xs text-white">
              Max duration reached
            </div>
          )}
        </div>

        <div className="space-y-4 bg-black/80 p-4">
          <div className="flex items-center justify-center gap-6">
            <Button
              onClick={() => setCamera((prev) => (prev === 'rear' ? 'front' : 'rear'))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              type="button"
              disabled={isRecording}
              title="Switch camera"
            >
              <Camera className="h-5 w-5" />
            </Button>
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-white text-black hover:bg-white/80'
              }`}
              type="button"
              title={isRecording ? 'Stop' : 'Start'}
            >
              <Video className="h-8 w-8" />
            </Button>
            <Button
              onClick={resetRecording}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              type="button"
              title="Reset"
              disabled={isRecording}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>

          {recordedChunks.length > 0 && (
            <div className="flex justify-center">
              <Button onClick={saveVideo} className="rounded-full bg-primary px-6 text-primary-foreground" type="button">
                Save video
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoRecorder;