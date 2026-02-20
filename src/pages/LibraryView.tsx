import { useState } from 'react';
import { useSpecimens } from '@/hooks/useSpecimens';
import SearchBar from '@/components/library/SearchBar';
import SpecimenGrid from '@/components/library/SpecimenGrid';
import SpecimenDetailDialog from '@/components/library/SpecimenDetailDialog';
import SyncButton from '@/components/library/SyncButton';
import { Specimen } from '@/types/specimen';

export default function LibraryView() {
  const {
    specimens,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload,
  } = useSpecimens();

  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);

  const handleSelect = (specimen: Specimen) => {
    setSelectedSpecimen(specimen);
  };

  const handleClose = () => {
    setSelectedSpecimen(null);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Specimen Library</h1>
            <p className="text-gray-600 mt-1">
              {specimens.length} specimen{specimens.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <SyncButton onSyncComplete={reload} />
        </div>

        <div className="mt-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      {/* Grid Section */}
      <SpecimenGrid
        specimens={specimens}
        onDelete={deleteSpecimen}
        onSelect={handleSelect}
      />

      <SpecimenDetailDialog
        specimen={selectedSpecimen}
        open={!!selectedSpecimen}
        onClose={handleClose}
        onUpdate={updateSpecimen}
      />
    </div>
  );
}
