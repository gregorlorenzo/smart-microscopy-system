import { useState, useEffect, useCallback } from 'react';
import { Specimen } from '@/types/specimen';
import { storage } from '@/lib/storage';

export function useSpecimens() {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadSpecimens = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await storage.getSpecimens();
      setSpecimens(data);
    } catch (error) {
      console.error('Error loading specimens:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpecimens();
  }, [loadSpecimens]);

  const filteredSpecimens = specimens.filter(specimen =>
    specimen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const deleteSpecimen = useCallback(async (id: string) => {
    await storage.deleteSpecimen(id);
    await loadSpecimens();
  }, [loadSpecimens]);

  const updateSpecimen = useCallback(async (id: string, updates: Partial<Specimen>) => {
    await storage.updateSpecimen(id, updates);
    await loadSpecimens();
  }, [loadSpecimens]);

  return {
    specimens: filteredSpecimens,
    allSpecimens: specimens,
    isLoading,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload: loadSpecimens,
  };
}
