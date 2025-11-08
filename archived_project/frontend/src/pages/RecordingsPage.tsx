import { useEffect, useState } from 'react';
import { RecordingCard } from '@/components/RecordingCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordingsApi } from '@/lib/api';
import type { Recording, RecordingMetadata } from '@/lib/api';

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('stopped'); // Mostrar apenas gravações bem-sucedidas por padrão
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editMetadata, setEditMetadata] = useState<RecordingMetadata>({});

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const response = await recordingsApi.list({
        page,
        limit: 10,
        search,
        status: filter === 'all' ? undefined : filter,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      setRecordings(response.recordings);
      setTotalPages(response.pages);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, [page, filter]);

  const handleSearch = () => {
    setPage(0);
    fetchRecordings();
  };

  const handleEdit = (recording: Recording) => {
    setEditingRecording(recording);
    setEditMetadata({
      title: recording.title || '',
      artist: recording.artist || '',
      album: recording.album || '',
      side: recording.side || '',
      notes: recording.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRecording) return;

    try {
      await recordingsApi.update(editingRecording.id, editMetadata);
      setEditingRecording(null);
      fetchRecordings();
    } catch (error) {
      console.error('Error updating recording:', error);
      alert('Failed to update recording');
    }
  };

  const handleCancelEdit = () => {
    setEditingRecording(null);
    setEditMetadata({});
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Recordings</h1>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search by album, artist, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-md"
          />
          <Button onClick={handleSearch}>Search</Button>

          <select
            className="px-4 py-2 rounded-md border border-input bg-background"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="stopped">Stopped</option>
            <option value="recording">Recording</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecording && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit Recording Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editMetadata.title || ''}
                  onChange={(e) => setEditMetadata({ ...editMetadata, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Artist</label>
                <Input
                  value={editMetadata.artist || ''}
                  onChange={(e) => setEditMetadata({ ...editMetadata, artist: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Album</label>
                <Input
                  value={editMetadata.album || ''}
                  onChange={(e) => setEditMetadata({ ...editMetadata, album: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Side</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editMetadata.side || ''}
                  onChange={(e) => setEditMetadata({ ...editMetadata, side: e.target.value })}
                >
                  <option value="">None</option>
                  <option value="A">Side A</option>
                  <option value="B">Side B</option>
                  <option value="C">Side C</option>
                  <option value="D">Side D</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editMetadata.notes || ''}
                onChange={(e) => setEditMetadata({ ...editMetadata, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit}>Save Changes</Button>
              <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading recordings...</p>
        </div>
      )}

      {/* Recordings List */}
      {!loading && recordings.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No recordings found</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {recordings.map((recording) => (
          <RecordingCard
            key={recording.id}
            recording={recording}
            onEdit={handleEdit}
            onRefresh={fetchRecordings}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}