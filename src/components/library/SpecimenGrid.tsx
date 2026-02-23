import { useState, useEffect } from 'react';
import { Specimen } from '@/types/specimen';
import SpecimenCard from './SpecimenCard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';

interface SpecimenGridProps {
  specimens: Specimen[];
  onDelete: (id: string) => void;
  onSelect: (specimen: Specimen) => void;
}

type ViewDensity = 'comfortable' | 'compact';

const ITEMS_PER_PAGE = 12;

export default function SpecimenGrid({ specimens, onDelete, onSelect }: SpecimenGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewDensity, setViewDensity] = useState<ViewDensity>('compact');

  // Reset to page 1 when specimens list changes (e.g., search filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [specimens.length]);

  const totalPages = Math.ceil(specimens.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSpecimens = specimens.slice(startIndex, endIndex);

  const gridCols = viewDensity === 'compact'
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (specimens.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-700">No specimens found</p>
          <p className="text-sm text-gray-500">Capture your first specimen in the Microscope view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
        <p className="text-sm text-gray-600">
          {specimens.length} specimen{specimens.length !== 1 ? 's' : ''} total
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">View:</span>
          <Button
            variant={viewDensity === 'comfortable' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewDensity('comfortable')}
            className="h-8 px-3"
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            Comfortable
          </Button>
          <Button
            variant={viewDensity === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewDensity('compact')}
            className="h-8 px-3"
          >
            <List className="w-3.5 h-3.5 mr-1" />
            Compact
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className={`grid ${gridCols} gap-4`}>
        {currentSpecimens.map(specimen => (
          <SpecimenCard
            key={specimen.id}
            specimen={specimen}
            onDelete={onDelete}
            onClick={onSelect}
            compact={viewDensity === 'compact'}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2">
            {/* Count label: desktop only */}
            <p className="text-sm text-gray-600 hidden sm:block">
              Showing {startIndex + 1}–{Math.min(endIndex, specimens.length)} of {specimens.length}
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>

              {/* Page numbers: desktop only */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  const showEllipsis =
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return <span key={page} className="px-2 text-gray-400">...</span>;
                  }
                  if (!showPage) return null;

                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className="min-w-[40px]"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              {/* Page indicator: mobile only */}
              <span className="sm:hidden text-sm font-medium text-gray-600">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
