import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Cloud, CloudOff, RefreshCw, Download, Upload } from 'lucide-react';
import { syncAllPending, pullFromCloud, isOnline } from '@/lib/sync';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SyncButtonProps {
  onSyncComplete?: () => void;
}

export default function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const online = isOnline();

  const handlePush = async () => {
    if (!online) {
      toast({
        title: 'Offline',
        description: 'You need an internet connection to sync',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { synced, failed } = await syncAllPending();

      if (synced > 0) {
        toast({
          title: 'Sync Complete',
          description: `Successfully synced ${synced} specimen(s)${failed > 0 ? `, ${failed} failed` : ''}`,
        });
      } else if (failed > 0) {
        toast({
          title: 'Sync Failed',
          description: `Failed to sync ${failed} specimen(s)`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Already Synced',
          description: 'All specimens are up to date',
        });
      }

      onSyncComplete?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync specimens',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!online) {
      toast({
        title: 'Offline',
        description: 'You need an internet connection to sync',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const { imported, updated } = await pullFromCloud();

      if (imported > 0 || updated > 0) {
        const messages = [];
        if (imported > 0) messages.push(`${imported} new`);
        if (updated > 0) messages.push(`${updated} updated`);

        toast({
          title: 'Sync Complete',
          description: `Downloaded ${messages.join(', ')} specimen(s)`,
        });
        onSyncComplete?.();
      } else {
        toast({
          title: 'Already Synced',
          description: 'No new specimens to download',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download specimens',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBothWays = async () => {
    if (!online) {
      toast({
        title: 'Offline',
        description: 'You need an internet connection to sync',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      // First pull from cloud (with conflict resolution)
      const { imported, updated } = await pullFromCloud();

      // Then push local changes
      const { synced, failed } = await syncAllPending();

      const messages = [];
      if (imported > 0) messages.push(`${imported} downloaded`);
      if (updated > 0) messages.push(`${updated} updated`);
      if (synced > 0) messages.push(`${synced} uploaded`);

      if (messages.length > 0) {
        toast({
          title: 'Sync Complete',
          description: messages.join(', '),
        });
        onSyncComplete?.();
      } else {
        toast({
          title: 'Already Synced',
          description: 'Everything is up to date',
        });
      }

      if (failed > 0) {
        toast({
          title: 'Partial Sync',
          description: `${failed} specimen(s) failed to upload`,
          variant: 'default',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync specimens',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!online) {
    return (
      <Button variant="outline" disabled>
        <CloudOff className="w-4 h-4 mr-2" />
        Offline
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isSyncing}>
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4 mr-2" />
              Sync
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleBothWays}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Both Ways
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePush}>
          <Upload className="w-4 h-4 mr-2" />
          Upload to Cloud
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePull}>
          <Download className="w-4 h-4 mr-2" />
          Download from Cloud
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
