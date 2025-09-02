import { useState, useEffect, useRef } from 'react';
import { AreaData, BoothStatus } from '../types/booth';
import { useBoothStatusCache } from './useBoothStatusCache';

export function useAreaData(areaId: string, hotReload: boolean = true) {
  const [data, setData] = useState<AreaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [switching, setSwitching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<string | null>(null);
  const baseAreaDataRef = useRef<AreaData | null>(null);
  
  // Use the global booth status cache (updates every 10 seconds in background)
  const { boothStatuses } = useBoothStatusCache();

  const loadBaseAreaData = async (isAreaSwitch = false) => {
    try {
      setError(null);
      if (isAreaSwitch) setSwitching(true);
      
      // Load base area data from JSON (only when needed)
      const response = await fetch(`/data/${areaId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load ${areaId} data`);
      }
      
      const lastModified = response.headers.get('last-modified');
      const areaData: AreaData = await response.json();
      
      // Always update for area switches, or when JSON file changed
      if (isAreaSwitch || !lastModifiedRef.current || lastModified !== lastModifiedRef.current) {
        baseAreaDataRef.current = areaData;
        lastModifiedRef.current = lastModified;
        console.log(`📁 Base area data loaded for ${areaId}`);
        
        // Immediately merge with cached sheet data for faster display
        mergeWithSheetData();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error loading base area data for ${areaId}:`, err);
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  };

  const mergeWithSheetData = () => {
    if (!baseAreaDataRef.current) return;
    
    // Merge booth statuses from Google Sheets cache with base area data
    const updatedAreaData: AreaData = {
      ...baseAreaDataRef.current,
      booths: baseAreaDataRef.current.booths.map(booth => {
        // Google Sheets data has PRIORITY over local JSON
        const sheetStatus = boothStatuses.get(booth.id);
        const finalStatus = sheetStatus !== undefined ? sheetStatus : booth.status;
        
        return {
          ...booth,
          status: finalStatus,
          // Update color based on status
          color: getColorForStatus(finalStatus)
        };
      })
    };
    
    setData(updatedAreaData);
  };

  // Helper function to get color based on status
  const getColorForStatus = (status: BoothStatus): string => {
    switch (status) {
      case 'sold':
        return '#66aaff';     // Blue
      case 'reserved':
        return '#ffaa66';     // Orange
      case 'available':
        return '#cccccc';     // Gray
      case 'nil':
        return '#ff69b4';     // Pink - indicates missing data
      default:
        return '#cccccc';
    }
  };

  // Load base area data on mount and when area changes
  useEffect(() => {
    if (!areaId) return;

    setLoading(true);
    // Pass true for area switch to indicate this is an area change
    loadBaseAreaData(true);

    // Set up JSON file polling (every 2 seconds for JSON changes only)
    if (hotReload && process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(() => loadBaseAreaData(false), 2000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [areaId, hotReload]);

  // Merge with sheet data whenever booth statuses change (every 10 seconds)
  useEffect(() => {
    mergeWithSheetData();
  }, [boothStatuses]);

  return { data, loading: loading || switching, error };
}