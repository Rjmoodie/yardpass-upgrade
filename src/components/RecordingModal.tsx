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
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { LiventixSpinner } from '@/components/LoadingSpinner';
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
  const [countdown, setCountdown] = useState<number | 'go' | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    audioLevel,
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
      if ('srcObject' in videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream, recordingType]);

  const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const resetCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (goTimeoutRef.current) {
      clearTimeout(goTimeoutRef.current);
      goTimeoutRef.current = null;
    }
    setCountdown(null);
  };

  const handleStartRecording = async () => {
    if (isRecording || countdown !== null) return;
    const ok = await requestPermission({ video: recordingType === 'video', audio: true });
    if (!ok) return;

    resetCountdown();
    let next = 3;
    setCountdown(next);
    countdownRef.current = setInterval(() => {
      next -= 1;
      if (next > 0) {
        setCountdown(next);
      } else {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdown('go');
        goTimeoutRef.current = setTimeout(() => {
          goTimeoutRef.current = null;
          setCountdown(null);
        }, 450);
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
      }
    }, 900);
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
    resetCountdown();
    onClose();
  };

  useEffect(() => {
    return () => {
      resetCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="rounded-3xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-2xl">
          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-background/60 to-background" />
            <DialogHeader className="relative px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                {isSupported ? `Create a ${recordingType === 'video' ? 'Video' : 'Audio'} Moment` : 'Recording not supported'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Capture a quick update to share with your network.
              </p>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 pb-6">
            {/* Recording Type Selector */}
            {!isRecording && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2">
                <div className="inline-flex rounded-full bg-background/60 p-1 text-sm shadow-inner">
                  <button
                    type="button"
                    onClick={() => setRecordingType('video')}
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 transition ${
                      recordingType === 'video'
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    disabled={!isSupported}
                  >
                    <VideoIcon className="h-4 w-4" />
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordingType('audio')}
                    className={`flex items-center gap-1 rounded-full px-4 py-1.5 transition ${
                      recordingType === 'audio'
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    disabled={!isSupported}
                  >
                    <Mic className="h-4 w-4" />
                    Audio
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-3 py-1">
                    <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-wide">
                      {permission === 'granted' ? 'Ready' : 'Awaiting access'}
                    </Badge>
                    {isRecording ? (
                      <span className="font-medium text-destructive">Live {formatDuration(duration)}</span>
                    ) : (
                      <span>Max 15 minutes</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Device pickers (optional) */}
            {!isRecording && isSupported && (
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
                {recordingType === 'video' && (
                  <label className="text-xs font-medium text-muted-foreground">
                    Camera
                    <select
                      className="mt-1 w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm"
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
                  </label>
                )}
                <label className="text-xs font-medium text-muted-foreground">
                  Microphone
                  <select
                    className="mt-1 w-full rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm"
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
                </label>
              </div>
            )}

            {/* Preview Area */}
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
              {recordingType === 'video' ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-video w-full rounded-2xl object-cover"
                  />
                  {isRecording && (
                    <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full bg-background/80 px-4 py-2 text-xs font-semibold text-destructive shadow">
                      <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                      Recording {formatDuration(duration)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-6 py-14 text-center">
                  <div className="relative flex h-40 w-40 items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-full bg-primary/20"
                      style={{
                        transform: `scale(${1 + audioLevel * 0.6})`,
                        opacity: 0.35 + audioLevel * 0.4,
                      }}
                    />
                    <div className="absolute inset-4 rounded-full bg-primary/10 blur-xl" />
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-primary/40 bg-background/90">
                      <Mic className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Volume2 className="h-4 w-4" />
                    <span className="font-medium text-foreground">{Math.round(audioLevel * 100)}% vibe</span>
                  </div>
                  {isRecording ? (
                    <Badge variant="destructive" className="text-xs font-semibold">
                      Recording {formatDuration(duration)}
                    </Badge>
                  ) : permission !== 'granted' ? (
                    <Badge variant="outline" className="text-xs">
                      Mic permission required
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Tap record to start your audio story.</span>
                  )}
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur">
                  <span className="text-6xl font-semibold text-primary">
                    {countdown === 'go' ? 'Go!' : countdown}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">Get ready…</span>
                </div>
              )}
            </div>

            {/* Error Display */}
            {(error || !isSupported) && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error || 'Your browser does not support MediaRecorder.'}
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-inner">
              {!isRecording ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {permission === 'granted'
                      ? 'All set — start when you are ready.'
                      : 'Allow camera and microphone access to begin.'}
                  </div>
                  <Button
                    onClick={handleStartRecording}
                    disabled={!isSupported || countdown !== null}
                    className="h-12 rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 text-base font-semibold text-primary-foreground shadow-lg hover:shadow-xl"
                  >
                    {recordingType === 'video' ? (
                      <VideoIcon className="mr-2 h-5 w-5" />
                    ) : (
                      <Mic className="mr-2 h-5 w-5" />
                    )}
                    {countdown !== null ? 'Lights…' : 'Start Recording'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {formatDuration(duration)} elapsed
                    </Badge>
                    {isPaused ? (
                      <span>Paused</span>
                    ) : (
                      <span className="text-foreground">Capture in progress</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className="rounded-full"
                    >
                      {isPaused ? (
                        <>
                          <Play className="mr-2 h-4 w-4" /> Resume
                        </>
                      ) : (
                        <>
                          <Pause className="mr-2 h-4 w-4" /> Pause
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleStopRecording}
                      className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Square className="mr-2 h-4 w-4" /> Save Clip
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        cancelRecording();
                        resetCountdown();
                      }}
                      className="rounded-full"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Retake
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {isRecording && permission !== 'granted' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LiventixSpinner size="xs" showGlow={false} showLogo={false} /> Waiting for permission…
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}