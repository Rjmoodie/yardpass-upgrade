/**
 * Video Debug Lab Page
 * 
 * Development-only page for testing video playback, HLS.js behavior,
 * and observing video errors and metrics in real-time.
 * 
 * Access at: /dev/video-lab
 */

import { useState, useRef, useEffect } from 'react';
import { VideoMedia } from '@/components/feed/VideoMedia';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

// Sample video URLs for testing
const TEST_VIDEOS = [
  {
    id: 'test-1',
    url: 'mux:test-playback-id-1',
    label: 'Test Video 1 (Mux)',
  },
  {
    id: 'test-2',
    url: 'mux:test-playback-id-2',
    label: 'Test Video 2 (Mux)',
  },
  {
    id: 'test-3',
    url: 'https://stream.mux.com/test-playback-id.m3u8',
    label: 'Test Video 3 (HLS URL)',
  },
];

// In-memory log storage for this session
const videoLogs: Array<{
  type: 'error' | 'metric' | 'info';
  message: string;
  data?: any;
  timestamp: number;
}> = [];

export default function VideoLabPage() {
  const [selectedVideo, setSelectedVideo] = useState(TEST_VIDEOS[0]);
  const [logs, setLogs] = useState<typeof videoLogs>([]);
  const [isVisible, setIsVisible] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Listen for video errors and metrics
  useEffect(() => {
    const originalError = console.error;
    const originalLog = console.log;

    // Intercept console errors related to video
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('video') || message.includes('HLS') || message.includes('Mux')) {
        addLog('error', message, args);
      }
      originalError.apply(console, args);
    };

    // Intercept console logs related to video
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('video') || message.includes('HLS') || message.includes('Mux')) {
        addLog('info', message, args);
      }
      originalLog.apply(console, args);
    };

    return () => {
      console.error = originalError;
      console.log = originalLog;
    };
  }, []);

  const addLog = (type: 'error' | 'metric' | 'info', message: string, data?: any) => {
    const logEntry = {
      type,
      message,
      data,
      timestamp: Date.now(),
    };
    videoLogs.push(logEntry);
    setLogs([...videoLogs]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      logContainerRef.current?.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  };

  const clearLogs = () => {
    videoLogs.length = 0;
    setLogs([]);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Video Debug Lab</h1>
        <p className="text-muted-foreground">
          Test video playback, observe HLS.js behavior, and monitor errors/metrics in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Player Section */}
        <Card>
          <CardHeader>
            <CardTitle>Video Player</CardTitle>
            <CardDescription>Test video playback with different sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Video</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedVideo.id}
                onChange={(e) => {
                  const video = TEST_VIDEOS.find((v) => v.id === e.target.value);
                  if (video) setSelectedVideo(video);
                }}
              >
                {TEST_VIDEOS.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Or Enter Custom URL</label>
              <input
                type="text"
                className="w-full p-2 border rounded-md"
                placeholder="mux:playback-id or https://..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const url = e.currentTarget.value;
                    if (url) {
                      setSelectedVideo({
                        id: 'custom',
                        url,
                        label: 'Custom Video',
                      });
                    }
                  }
                }}
              />
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="visible"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="visible" className="text-sm">
                Video Visible (affects preloading)
              </label>
            </div>

            {/* Video Player */}
            <div className="border rounded-lg overflow-hidden bg-black">
              <VideoMedia
                url={selectedVideo.url}
                post={{
                  id: 'test-post',
                  event_id: 'test-event',
                }}
                visible={isVisible}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <Button onClick={clearLogs} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Logs
              </Button>
              <Button
                onClick={() => {
                  addLog('info', 'Manual test log entry', { test: true });
                }}
                variant="outline"
                size="sm"
              >
                Add Test Log
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Section */}
        <Card>
          <CardHeader>
            <CardTitle>Real-Time Logs</CardTitle>
            <CardDescription>
              Video errors, metrics, and HLS.js events appear here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All ({logs.length})</TabsTrigger>
                <TabsTrigger value="errors">
                  Errors ({logs.filter((l) => l.type === 'error').length})
                </TabsTrigger>
                <TabsTrigger value="metrics">
                  Metrics ({logs.filter((l) => l.type === 'metric').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <LogViewer logs={logs} containerRef={logContainerRef} />
              </TabsContent>
              <TabsContent value="errors" className="mt-4">
                <LogViewer
                  logs={logs.filter((l) => l.type === 'error')}
                  containerRef={logContainerRef}
                />
              </TabsContent>
              <TabsContent value="metrics" className="mt-4">
                <LogViewer
                  logs={logs.filter((l) => l.type === 'metric')}
                  containerRef={logContainerRef}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Video State Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Video State Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">User Agent</div>
              <div className="text-sm font-mono truncate">{navigator.userAgent}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Network Type</div>
              <div className="text-sm">
                {(navigator as any).connection?.effectiveType || 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">HLS.js Supported</div>
              <div className="text-sm">
                {typeof window !== 'undefined' && 'Hls' in window ? 'Yes' : 'Checking...'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Native HLS</div>
              <div className="text-sm">
                {typeof document !== 'undefined'
                  ? document.createElement('video').canPlayType('application/vnd.apple.mpegurl')
                    ? 'Yes'
                    : 'No'
                  : 'Unknown'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogViewer({
  logs,
  containerRef,
}: {
  logs: typeof videoLogs;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No logs yet. Play a video to see events here.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[400px] overflow-y-auto border rounded-md p-4 bg-muted/30 space-y-2"
    >
      {logs.map((log, idx) => (
        <div
          key={idx}
          className={`p-2 rounded text-sm ${
            log.type === 'error'
              ? 'bg-destructive/10 border border-destructive/20'
              : log.type === 'metric'
              ? 'bg-blue-500/10 border border-blue-500/20'
              : 'bg-muted border'
          }`}
        >
          <div className="flex items-start gap-2">
            {log.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            ) : log.type === 'metric' ? (
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={log.type === 'error' ? 'destructive' : 'secondary'}>
                  {log.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="font-mono text-xs break-words">{log.message}</div>
              {log.data && (
                <details className="mt-1">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    View details
                  </summary>
                  <pre className="mt-1 text-xs overflow-x-auto bg-background p-2 rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

