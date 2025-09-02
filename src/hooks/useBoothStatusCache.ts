import { useState, useEffect, useRef } from 'react';
import { BoothStatus } from '../types/booth';
import { fetchBoothStatusFromSheets } from '../services/googleSheets';

// Global cache for booth statuses - shared across all components
let globalBoothStatusCache = new Map<string, BoothStatus>();
let globalCacheTimestamp = 0;
const CACHE_DURATION = 10000; // 10 seconds

export function useBoothStatusCache() {
  const [boothStatuses, setBoothStatuses] = useState<Map<string, BoothStatus>>(globalBoothStatusCache);
  const [lastUpdated, setLastUpdated] = useState<number>(globalCacheTimestamp);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateCache = async () => {
    try {
      const newStatuses = await fetchBoothStatusFromSheets();
      
      // Only update if we got valid data
      if (newStatuses.size > 0) {
        globalBoothStatusCache = newStatuses;
        globalCacheTimestamp = Date.now();
        
        // Update local state to trigger re-renders
        setBoothStatuses(new Map(newStatuses));
        setLastUpdated(globalCacheTimestamp);
        
        console.log(`🔄 Booth status cache updated with ${newStatuses.size} entries`);
      }
    } catch (error) {
      console.error('Error updating booth status cache:', error);
    }
  };

  useEffect(() => {
    // Initial load
    updateCache();

    // Set up background polling every 10 seconds
    intervalRef.current = setInterval(updateCache, CACHE_DURATION);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    boothStatuses,
    lastUpdated,
    isStale: Date.now() - lastUpdated > CACHE_DURATION * 2, // Consider stale after 20 seconds
  };
}