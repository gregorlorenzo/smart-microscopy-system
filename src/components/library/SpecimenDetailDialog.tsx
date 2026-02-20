import { Specimen } from '@/types/specimen';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Video, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { downloadImage, downloadVideo } from '@/lib/capture';
import { useState, useEffect } from 'react';

interface SpecimenDetailDialogProps {
  specimen: Specimen | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Specimen>) => void;
}

export default function SpecimenDetailDialog({
  specimen,
  open,
  onClose,
  onUpdate,
}: SpecimenDetailDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Sync state with specimen prop when it changes
  useEffect(() => {
    if (specimen) {
      setName(specimen.name || '');
      setDescription(specimen.description || '');
      setError('');
    }
  }, [specimen]);

  const handleSave = () => {
    // Validate name is required
    if (!name.trim()) {
      setError('Specimen name is required');
      return;
    }

    if (specimen) {
      onUpdate(specimen.id, { name: name.trim(), description });
      onClose();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError(''); // Clear error when user types
  };

  const handleDownloadVideo = () => {
    if (!specimen?.videoUrl) return;

    // Convert data URL to blob
    fetch(specimen.videoUrl)
      .then(res => res.blob())
      .then(blob => {
        downloadVideo(blob, `${specimen.name}-video.webm`);
      })
      .catch(err => {
        console.error('Failed to download video:', err);
      });
  };

  if (!specimen) return null;

  const hasVideo = !!specimen.videoUrl;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Specimen Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {hasVideo ? (
              <Tabs defaultValue="image" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Image
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    <Video className="w-4 h-4 mr-2" />
                    Video
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="image">
                  <img
                    src={specimen.imageUrl}
                    alt={specimen.name}
                    className="w-full rounded-lg border"
                  />
                </TabsContent>
                <TabsContent value="video">
                  <video
                    src={specimen.videoUrl}
                    controls
                    className="w-full rounded-lg border bg-black"
                  >
                    Your browser does not support the video tag.
                  </video>
                </TabsContent>
              </Tabs>
            ) : (
              <img
                src={specimen.imageUrl}
                alt={specimen.name}
                className="w-full rounded-lg border"
              />
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={handleNameChange}
                className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
                rows={3}
              />
            </div>

            <div>
              <Label>Tags</Label>
              {specimen.tags && specimen.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {specimen.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-1">No tags</p>
              )}
            </div>

            <div>
              <Label>Captured</Label>
              <p className="text-sm text-gray-600">
                {format(specimen.capturedAt, 'MMMM d, yyyy h:mm a')}
              </p>
            </div>

            <div>
              <Label>Annotations</Label>
              <p className="text-sm text-gray-600">
                {specimen.annotations.length} annotation(s)
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handleSave}>
                Save Changes
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadImage(specimen.imageUrl, `${specimen.name}.jpg`)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Image
                </Button>
                {hasVideo && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadVideo}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Video
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
