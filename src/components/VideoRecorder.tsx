import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Video, X } from 'lucide-react';

interface VideoRecorderProps {
  eventId: string;
  onClose: () => void;
  onSave: (videoBlob: Blob) => void;
}

export function VideoRecorder({ eventId, onClose, onSave }: VideoRecorderProps) {
  const [camera, setCamera] = useState<'front' | 'rear'>('rear');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  void eventId;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera === 'rear' ? 'environment' : 'user' },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      mediaRecorderRef.current = mediaRecorder;
      setRecordedChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordedChunks([]);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const saveVideo = () => {
    if (!recordedChunks.length) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    onSave(blob);
    setRecordedChunks([]);
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordedChunks([]);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    onClose();
  };

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
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {isRecording && (
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Recording
            </div>
          )}
        </div>

        <div className="space-y-4 bg-black/80 p-4">
          <div className="flex items-center justify-center gap-6">
            <Button
              onClick={() => setCamera((prev) => (prev === 'rear' ? 'front' : 'rear'))}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              type="button"
            >
              <Camera className="h-5 w-5" />
            </Button>
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-white text-black hover:bg-white/80'
              }`}
              type="button"
            >
              <Video className="h-8 w-8" />
            </Button>
            <Button
              onClick={resetRecording}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              type="button"
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
