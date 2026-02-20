import { useState } from 'react';
import { Specimen } from '@/types/specimen';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Trash2, Download, Video } from 'lucide-react';
import { format } from 'date-fns';
import { downloadImage } from '@/lib/capture';

interface SpecimenCardProps {
  specimen: Specimen;
  onDelete: (id: string) => void;
  onClick: (specimen: Specimen) => void;
  compact?: boolean;
}

export default function SpecimenCard({ specimen, onDelete, onClick, compact = true }: SpecimenCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Adjust sizes based on compact mode
  const imageHeight = compact ? 'h-32' : 'h-40';
  const titleSize = compact ? 'text-base' : 'text-lg';
  const descriptionLines = compact ? 'line-clamp-1' : 'line-clamp-2';
  const padding = compact ? 'p-3' : 'p-4';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadImage(specimen.imageUrl, `${specimen.name}.png`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(specimen.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card className="cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-200 overflow-hidden group" onClick={() => onClick(specimen)}>
        <CardHeader className="p-0 relative overflow-hidden">
          <img
            src={specimen.imageUrl}
            alt={specimen.name}
            className={`w-full ${imageHeight} object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-300`}
          />
          {specimen.videoUrl && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1.5 shadow-lg">
              <Video className="w-3 h-3" />
            </div>
          )}
        </CardHeader>
        <CardContent className={padding}>
          <CardTitle className={`${titleSize} truncate font-semibold`}>{specimen.name}</CardTitle>
          {specimen.description && (
            <p className={`text-xs text-gray-600 mt-1 ${descriptionLines}`}>{specimen.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-1 mt-2">
            <Badge variant="secondary" className="text-xs py-0 h-5">
              {format(specimen.capturedAt, 'MMM d, yyyy')}
            </Badge>
            {specimen.videoUrl && (
              <Badge variant="outline" className="gap-1 text-xs py-0 h-5">
                <Video className="w-2.5 h-2.5" />
                Video
              </Badge>
            )}
            {specimen.syncedToCloud && (
              <Badge variant="outline" className="text-xs py-0 h-5">Synced</Badge>
            )}
          </div>
          {specimen.tags && specimen.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {specimen.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs py-0 h-5">{tag}</Badge>
              ))}
              {specimen.tags.length > 3 && (
                <Badge variant="outline" className="text-xs py-0 h-5">+{specimen.tags.length - 3}</Badge>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className={`${padding} pt-0 flex gap-2`}>
          <Button size="sm" variant="outline" onClick={handleDownload} className="flex-1 h-8 text-xs">
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteClick} className="h-8 px-2">
            <Trash2 className="w-3 h-3" />
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete Specimen"
        description={`Are you sure you want to delete "${specimen.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}
