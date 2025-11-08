import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { captureApi } from '@/lib/api';
import type { CaptureStatus, RecordingMetadata } from '@/lib/api';

export function CaptureControls() {
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<RecordingMetadata>({
    title: '',
    artist: '',
    album: '',
    side: '',
    notes: ''
  });

  // Fetch status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await captureApi.status();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      await captureApi.start(metadata);
      // Clear metadata after successful start
      setMetadata({
        title: '',
        artist: '',
        album: '',
        side: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Check if device is connected.');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await captureApi.stop();
    } catch (error) {
      console.error('Error stopping recording:', error);
      alert('Failed to stop recording');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl">Vinyl Direct Capture</CardTitle>
            <CardDescription>
              High-quality audio recording from your turntable
            </CardDescription>
          </div>
          {status?.isCapturing && (
            <Badge variant="destructive" className="animate-pulse text-lg px-4 py-2">
              ● REC
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Display */}
        {status?.isCapturing && status.currentRecording && (
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Duration</span>
                <p className="text-2xl font-mono font-bold">
                  {formatDuration(status.currentRecording.duration)}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">File Size</span>
                <p className="text-2xl font-mono font-bold">
                  {formatBytes(status.currentRecording.fileSize)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Buffer Usage</span>
                <span>{Math.round((status.currentRecording.fileSize / (1024 * 1024 * 100)) * 100)}%</span>
              </div>
              <Progress
                value={Math.min((status.currentRecording.fileSize / (1024 * 1024 * 100)) * 100, 100)}
                className="h-2"
              />
            </div>
          </div>
        )}

        {/* Device Info */}
        {status?.device && (
          <div className="bg-muted/50 p-3 rounded text-sm">
            <span className="text-muted-foreground">Device: </span>
            <span className="font-medium">{status.device.name}</span>
            <span className="mx-2">•</span>
            <span>{status.device.sampleRate / 1000}kHz / {status.device.bitDepth}bit / {status.device.channels}ch</span>
          </div>
        )}

        {/* Recording Metadata Form */}
        {!status?.isCapturing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Track or album side name"
                  value={metadata.title}
                  onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="artist">Artist</Label>
                <Input
                  id="artist"
                  placeholder="Artist name"
                  value={metadata.artist}
                  onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="album">Album</Label>
                <Input
                  id="album"
                  placeholder="Album name"
                  value={metadata.album}
                  onChange={(e) => setMetadata({ ...metadata, album: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="side">Side</Label>
                <select
                  id="side"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={metadata.side}
                  onChange={(e) => setMetadata({ ...metadata, side: e.target.value })}
                >
                  <option value="">Select side</option>
                  <option value="A">Side A</option>
                  <option value="B">Side B</option>
                  <option value="C">Side C</option>
                  <option value="D">Side D</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Any additional notes about this recording..."
                value={metadata.notes}
                onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-3">
          {!status?.isCapturing ? (
            <Button
              onClick={handleStart}
              disabled={loading}
              size="lg"
              className="flex-1"
            >
              {loading ? 'Starting...' : '● Start Recording'}
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              disabled={loading}
              variant="destructive"
              size="lg"
              className="flex-1"
            >
              {loading ? 'Stopping...' : '■ Stop Recording'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}