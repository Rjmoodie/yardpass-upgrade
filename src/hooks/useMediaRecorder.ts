import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecorderState {
  isSupported: boolean;
  permission: 'unknown' | 'granted' | 'denied';
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // ms (excludes paused time)
  error: string | null;
  stream: MediaStream | null;
  audioLevel: number; // 0-1 normalized peak level
}

type StartOpts = {
  video?: boolean; // default true
  audio?: boolean; // default true
  timesliceMs?: number; // default 100
  videoDeviceId?: string;
  audioDeviceId?: string;
  videoFacingMode?: 'user' | 'environment';
  audioConstraints?: MediaTrackConstraints;
  videoConstraints?: MediaTrackConstraints;
  maxDurationMs?: number; // optional auto-stop
};

function pickSupportedMime(prefer: string[]): string | undefined {
  for (const type of prefer) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function useMediaRecorder() {
  const [state, setState] = useState<RecorderState>({
    isSupported: typeof window !== 'undefined' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia,
    permission: 'unknown',
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
    stream: null,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startAtRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  const cleanupAudioMonitoring = () => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    try {
      audioContextRef.current?.close();
    } catch {}
    audioContextRef.current = null;
    analyserRef.current = null;
    if (!unmountedRef.current) {
      setState(s => ({ ...s, audioLevel: 0 }));
    }
  };

  const clearTimers = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      // cleanup on unmount
      try {
        unmountedRef.current = true;
        clearTimers();
        mediaRecorderRef.current?.stop();
      } catch {}
      state.stream?.getTracks().forEach(t => t.stop());
      cleanupAudioMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPermission = useCallback(async (opts: Partial<StartOpts> = {}) => {
    if (!state.isSupported) {
      setState(s => ({ ...s, permission: 'denied', error: 'MediaRecorder not supported in this browser.' }));
      return false;
    }
    try {
      const video = opts.video ?? true;
      const audio = opts.audio ?? true;
      const constraints: MediaStreamConstraints = {
        video: video
          ? {
              facingMode: opts.videoFacingMode ?? 'user',
              deviceId: opts.videoDeviceId ? { exact: opts.videoDeviceId } : undefined,
              ...(opts.videoConstraints ?? {}),
            }
          : false,
        audio: audio
          ? {
              deviceId: opts.audioDeviceId ? { exact: opts.audioDeviceId } : undefined,
              ...(opts.audioConstraints ?? {}),
            }
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // immediately stop tracks; this is just a preflight ask
      stream.getTracks().forEach(t => t.stop());
      setState(s => ({ ...s, permission: 'granted', error: null }));
      return true;
    } catch (e: any) {
      setState(s => ({
        ...s,
        permission: 'denied',
        error: e?.message || 'Permission was denied.',
      }));
      return false;
    }
  }, [state.isSupported]);

  const startRecording = useCallback(async (video = true, audio = true, extra?: Omit<StartOpts, 'video' | 'audio'>) => {
    setState(s => ({ ...s, error: null }));
    chunksRef.current = [];
    accumulatedMsRef.current = 0;

    try {
      const constraints: MediaStreamConstraints = {
        video: video
          ? {
              facingMode: extra?.videoFacingMode ?? 'user',
              deviceId: extra?.videoDeviceId ? { exact: extra.videoDeviceId } : undefined,
              ...(extra?.videoConstraints ?? {}),
            }
          : false,
        audio: audio
          ? {
              deviceId: extra?.audioDeviceId ? { exact: extra.audioDeviceId } : undefined,
              ...(extra?.audioConstraints ?? {}),
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // codec preferences
      const isVideo = !!constraints.video;
      const prefer = isVideo
        ? [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4;codecs=h264,aac', // Safari 14+
            'video/mp4',
          ]
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=aac', 'audio/mp4'];

      const mimeType = pickSupportedMime(prefer);

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      // setup audio level monitoring if we have audio
      if (constraints.audio) {
        cleanupAudioMonitoring();
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as
          | typeof AudioContext
          | undefined;
        if (AudioCtx) {
          try {
            const ctx = new AudioCtx();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.7;
            source.connect(analyser);

            audioContextRef.current = ctx;
            analyserRef.current = analyser;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            levelIntervalRef.current = setInterval(() => {
              try {
                analyser.getByteTimeDomainData(dataArray);
                let sumSquares = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  const value = dataArray[i] / 128 - 1;
                  sumSquares += value * value;
                }
                const rms = Math.sqrt(sumSquares / dataArray.length);
                const level = Math.min(1, Math.sqrt(rms));
                setState(s => ({ ...s, audioLevel: level }));
              } catch {
                setState(s => ({ ...s, audioLevel: 0 }));
              }
            }, 100);
          } catch (err) {
            console.warn('Failed to initialize audio meter', err);
          }
        }
      }

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstart = () => {
        startAtRef.current = Date.now();
        setState(s => ({ ...s, isRecording: true, isPaused: false, duration: 0, stream }));
        clearTimers();
        durationIntervalRef.current = setInterval(() => {
          setState(s => ({
            ...s,
            duration: accumulatedMsRef.current + (Date.now() - startAtRef.current),
          }));
        }, 100);

        if (extra?.maxDurationMs && extra.maxDurationMs > 0) {
          autoStopTimerRef.current = setTimeout(() => {
            try {
              mr.stop();
            } catch {}
          }, extra.maxDurationMs);
        }
      };

      mr.onpause = () => {
        // freeze duration and accumulate
        accumulatedMsRef.current += Date.now() - startAtRef.current;
        setState(s => ({ ...s, isPaused: true, audioLevel: 0 }));
        clearTimers();
      };

      mr.onresume = () => {
        startAtRef.current = Date.now();
        setState(s => ({ ...s, isPaused: false }));
        clearTimers();
        durationIntervalRef.current = setInterval(() => {
          setState(s => ({
            ...s,
            duration: accumulatedMsRef.current + (Date.now() - startAtRef.current),
          }));
        }, 100);
      };

      mr.start(extra?.timesliceMs ?? 100);
      setState(s => ({ ...s, stream, error: null }));
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      cleanupAudioMonitoring();
      setState(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Failed to start recording',
        isRecording: false,
        isPaused: false,
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise<File>((resolve, reject) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      mr.onstop = () => {
        clearTimers();

        const elapsed = state.isPaused
          ? accumulatedMsRef.current
          : accumulatedMsRef.current + (Date.now() - startAtRef.current);

      const stream = state.stream;
      stream?.getTracks().forEach(t => t.stop());
      cleanupAudioMonitoring();

      const usedMime =
        mr.mimeType ||
        (chunksRef.current[0]?.type ??
          (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'));

        const blob = new Blob(chunksRef.current, { type: usedMime || 'application/octet-stream' });

        const filename = `recording-${Date.now()}.${
          (usedMime.includes('webm') && 'webm') ||
          (usedMime.includes('mp4') && 'mp4') ||
          (usedMime.startsWith('audio/') && 'webm') ||
          'bin'
        }`;

        const file = new File([blob], filename, { type: blob.type });

        // reset refs
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        accumulatedMsRef.current = 0;
        startAtRef.current = 0;

        setState(s => ({
          ...s,
          isRecording: false,
          isPaused: false,
          duration: 0,
          stream: null,
          error: null,
        }));

        // attach measured duration (ms) as a hint
        Object.defineProperty(file, 'durationMs', { value: elapsed, enumerable: false });
        resolve(file);
      };

      try {
        mr.stop();
      } catch (e) {
        reject(e);
      }
    });
  }, [state.isPaused, state.stream]);

  const pauseRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      try {
        mr.pause();
      } catch {}
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'paused') {
      try {
        mr.resume();
      } catch {}
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    clearTimers();

    try {
      if (mr && mr.state !== 'inactive') mr.stop();
    } catch {}
    try {
      state.stream?.getTracks().forEach(t => t.stop());
    } catch {}

    cleanupAudioMonitoring();

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    accumulatedMsRef.current = 0;
    startAtRef.current = 0;

    setState(s => ({
      ...s,
      isRecording: false,
      isPaused: false,
      duration: 0,
      stream: null,
      error: null,
      audioLevel: 0,
    }));
  }, [state.stream]);

  return {
    ...state,
    requestPermission,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  };
}