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
  const [elapsedMs, setElapsedMs] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<{ maxTimeout: number | null; tickInterval: number | null; startedAt: number | null }>({
    maxTimeout: null,
    tickInterval: null,
    startedAt: null,
  });

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
      setElapsedMs(0);

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

      stopTimerRef.current.startedAt = performance.now();
      stopTimerRef.current.tickInterval = window.setInterval(() => {
        if (!stopTimerRef.current.startedAt) return;
        const diff = Math.max(0, performance.now() - stopTimerRef.current.startedAt);
        setElapsedMs(Math.round(diff));
      }, 200);

      // Optional max duration (e.g., 90s). Remove if not needed.
      const MAX_MS = 90_000;
      stopTimerRef.current.maxTimeout = window.setTimeout(() => {
        setMaxReached(true);
        stopRecording();
      }, MAX_MS);
    } catch (error) {
      toast({ title: 'Unable to start recording', description: String(error), variant: 'destructive' });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current.maxTimeout) {
      clearTimeout(stopTimerRef.current.maxTimeout);
      stopTimerRef.current.maxTimeout = null;
    }
    if (stopTimerRef.current.tickInterval) {
      clearInterval(stopTimerRef.current.tickInterval);
      stopTimerRef.current.tickInterval = null;
    }
    stopTimerRef.current.startedAt = null;
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
    setElapsedMs(0);
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
    setElapsedMs(0);
  }, [recordedChunks, onSave]);

  const handleClose = useCallback(() => {
    if (isRecording) stopRecording();
    setRecordedChunks([]);
    setElapsedMs(0);
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
      if (stopTimerRef.current.tickInterval) {
        clearInterval(stopTimerRef.current.tickInterval);
        stopTimerRef.current.tickInterval = null;
      }
      if (stopTimerRef.current.maxTimeout) {
        clearTimeout(stopTimerRef.current.maxTimeout);
        stopTimerRef.current.maxTimeout = null;
      }
      stopTimerRef.current.startedAt = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const formattedMinutes = totalSeconds >= 0 ? String(Math.floor(totalSeconds / 60)).padStart(2, '0') : '00';
  const formattedSeconds = totalSeconds >= 0 ? String(totalSeconds % 60).padStart(2, '0') : '00';
  const hasRecording = recordedChunks.length > 0;
  const statusLabel = permissionError
    ? permissionError
    : maxReached
      ? 'Max duration reached'
      : isRecording
        ? 'Recording'
        : hasRecording
          ? 'Preview ready'
          : 'Camera ready';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex h-full flex-col text-white">
        <div className="flex items-center justify-between bg-black/80 px-4 py-3">
          <Button variant="ghost" onClick={handleClose} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden />
            <span className="sr-only">Close recorder</span>
          </Button>
          <div className="flex flex-col items-center gap-0.5 text-xs uppercase tracking-wide text-white/80">
            <span className="text-sm font-semibold text-white">Video Recorder</span>
            <span className="text-[10px]">Max 1:30</span>
          </div>
          <div className="w-10" />
        </div>

        <div className="relative flex-1 bg-black">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/60" aria-hidden />
          <video ref={videoRef} className="relative h-full w-full object-cover" autoPlay muted playsInline />

          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
            <div className="flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold">
              <span className={`flex h-2 w-2 items-center justify-center rounded-full ${isRecording ? 'animate-pulse bg-red-500' : 'bg-white/60'}`} />
              <span aria-live="polite">{statusLabel}</span>
              <span className="text-xs font-medium text-white/70">{formattedMinutes}:{formattedSeconds}</span>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center text-xs text-white/70">
            <div className="rounded-full bg-black/60 px-3 py-1">
              Tap stop to finish. You can re-record before saving.
            </div>
          </div>
        </div>

        <div className="bg-black/90 px-4 py-5 shadow-[0_-12px_24px_-16px_rgba(0,0,0,1)]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={() => setCamera((prev) => (prev === 'rear' ? 'front' : 'rear'))}
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/10 py-3 text-white hover:bg-white/20"
                type="button"
                disabled={isRecording}
              >
                <Camera className="h-5 w-5" aria-hidden />
                <span className="text-xs font-medium">Flip</span>
              </Button>
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-white transition ${
                  isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
                }`}
                type="button"
              >
                <Video className="h-6 w-6" aria-hidden />
                <span className="text-xs font-semibold">{isRecording ? 'Stop' : 'Record'}</span>
              </Button>
              <Button
                onClick={resetRecording}
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/10 py-3 text-white hover:bg-white/20 disabled:opacity-40"
                type="button"
                disabled={isRecording || !hasRecording}
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
                <span className="text-xs font-medium">Retake</span>
              </Button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-white/70">
              <div className="flex items-center justify-between">
                <span>Recording length</span>
                <span className="font-semibold text-white">{formattedMinutes}:{formattedSeconds}</span>
              </div>
              {maxReached && <span className="text-[11px] text-amber-300">Maximum clip length reached.</span>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="h-11 flex-1 rounded-xl bg-white/10 text-sm font-medium text-white hover:bg-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={saveVideo}
                disabled={!hasRecording}
                className="h-11 flex-1 rounded-xl bg-white text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                Save &amp; attach
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoRecorder;