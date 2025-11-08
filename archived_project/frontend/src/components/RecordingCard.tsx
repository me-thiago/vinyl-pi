import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WaveSurferPlayer } from './WaveSurferPlayer';
import { recordingsApi } from '@/lib/api';
import type { Recording } from '@/lib/api';
import { format } from 'date-fns';

interface RecordingCardProps {
  recording: Recording;
  onEdit?: (recording: Recording) => void;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
}

export function RecordingCard({ recording, onEdit, onDelete, onRefresh }: RecordingCardProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = () => {
    window.open(recordingsApi.getDownloadUrl(recording.id), '_blank');
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this recording?')) {
      try {
        await recordingsApi.delete(recording.id);
        onDelete?.(recording.id);
        onRefresh?.();
      } catch (error) {
        console.error('Error deleting recording:', error);
        alert('Failed to delete recording');
      }
    }
  };

  const getBadgeVariant = () => {
    switch (recording.status) {
      case 'recording':
        return 'destructive';
      case 'stopped':
        return 'default';
      case 'failed':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl">
              {recording.title || 'Untitled Recording'}
            </CardTitle>
            <CardDescription className="mt-1">
              {recording.artist && <span>{recording.artist}</span>}
              {recording.artist && recording.album && ' • '}
              {recording.album && <span>{recording.album}</span>}
              {recording.side && ` • Side ${recording.side}`}
            </CardDescription>
          </div>
          <Badge variant={getBadgeVariant()}>
            {recording.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {recording.status === 'stopped' && recording.fileSizeBytes > 0 && (
          <div className="mb-4">
            <WaveSurferPlayer
              url={recordingsApi.getStreamUrl(recording.id)}
              height={60}
            />
          </div>
        )}

        {recording.status === 'failed' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            ⚠️ Gravação falhou - Dispositivo de áudio estava ocupado
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="block font-medium">Duration</span>
            {formatDuration(recording.durationSeconds)}
          </div>
          <div>
            <span className="block font-medium">Size</span>
            {formatBytes(recording.fileSizeBytes)}
          </div>
          <div>
            <span className="block font-medium">Quality</span>
            {recording.sampleRate / 1000}kHz / {recording.bitDepth}bit
          </div>
          <div>
            <span className="block font-medium">Recorded</span>
            {format(new Date(recording.startedAt), 'MMM dd, HH:mm')}
          </div>
        </div>

        {recording.notes && (
          <p className="mt-4 text-sm bg-muted p-3 rounded">
            {recording.notes}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          onClick={handleDownload}
          disabled={recording.status !== 'stopped'}
        >
          Download
        </Button>
        <Button
          variant="outline"
          onClick={() => onEdit?.(recording)}
        >
          Edit Info
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={recording.status === 'recording'}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}