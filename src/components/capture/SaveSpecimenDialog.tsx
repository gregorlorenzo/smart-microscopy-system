import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SaveSpecimenDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string; tags: string[] }) => void;
}

export default function SaveSpecimenDialog({ open, onClose, onSave }: SaveSpecimenDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    // Validate name is required
    if (!name.trim()) {
      setError('Specimen name is required');
      return;
    }

    const tagArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSave({
      name: name.trim(),
      description,
      tags: tagArray,
    });

    // Reset form
    setName('');
    setDescription('');
    setTags('');
    setError('');
    onClose();
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setTags('');
    setError('');
    onClose();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError(''); // Clear error when user types
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Save Specimen to Library</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="Enter specimen name"
              autoFocus
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
              placeholder="Add a description (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. cell, bacteria, sample1 (comma-separated)"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save to Library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
