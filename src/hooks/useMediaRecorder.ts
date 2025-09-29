import { useCallback, useRef, useState } from 'react';

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
}

export function useMediaRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async (video = true, audio = true) => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: video ? { facingMode: 'user' } : false, 
        audio 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm' 
          : 'video/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        startTimeRef.current = Date.now();
        setState(prev => ({ ...prev, isRecording: true, isPaused: false }));
        
        // Update duration every 100ms
        durationIntervalRef.current = setInterval(() => {
          setState(prev => ({ 
            ...prev, 
            duration: Date.now() - startTimeRef.current 
          }));
        }, 100);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start recording'
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise<File>((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      mediaRecorder.onstop = () => {
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { 
          type: MediaRecorder.isTypeSupported('video/webm') 
            ? 'video/webm' 
            : 'video/mp4'
        });
        
        const filename = `recording-${Date.now()}.${
          MediaRecorder.isTypeSupported('video/webm') ? 'webm' : 'mp4'
        }`;
        
        const file = new File([blob], filename, { type: blob.type });

        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          error: null
        });

        resolve(file);
      };

      mediaRecorder.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      
      // Resume duration updates
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ 
          ...prev, 
          duration: Date.now() - startTimeRef.current 
        }));
      }, 100);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: null
    });

    chunksRef.current = [];
  }, []);

  return {
    ...state,
    stream: streamRef.current,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording
  };
}