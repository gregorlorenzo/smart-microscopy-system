import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSpecimens } from '@/hooks/useSpecimens';
import SpecimenGrid from '@/components/library/SpecimenGrid';
import SpecimenDetailDialog from '@/components/library/SpecimenDetailDialog';
import { Specimen } from '@/types/specimen';

export default function SessionLibraryPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const {
    specimens,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload,
  } = useSpecimens();

  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);

  const handleBack = () => navigate(`/session/${code}/stream`);
  // "Add Specimen" sends user to the stream to capture from the live feed
  const handleAddSpecimen = () => navigate(`/session/${code}/stream`);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-600 hover:text-gray-900"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-base font-semibold text-gray-900">Specimen Library</h1>
        <Button size="sm" className="gap-1.5" onClick={handleAddSpecimen}>
          <Plus className="w-4 h-4" />
          Add Specimen
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Search + filter row */}
        <div className="flex gap-3">
          <Input
            placeholder="Search specimens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" className="gap-1.5 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            All Types
          </Button>
        </div>

        {/* Specimen grid — reuses existing component */}
        <SpecimenGrid
          specimens={specimens}
          onDelete={deleteSpecimen}
          onSelect={setSelectedSpecimen}
        />
      </div>

      {/* Detail dialog — reuses existing component */}
      <SpecimenDetailDialog
        specimen={selectedSpecimen}
        open={!!selectedSpecimen}
        onClose={() => {
          setSelectedSpecimen(null);
          reload();
        }}
        onUpdate={updateSpecimen}
      />
    </div>
  );
}
