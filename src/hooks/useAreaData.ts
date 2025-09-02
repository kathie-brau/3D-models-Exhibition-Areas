import { useState, useEffect, useRef } from 'react';
import { AreaData, BoothStatus } from '../types/booth';
import { fetchBoothStatusFromSheets } from '../services/googleSheets';

export function useAreaData(areaId: string, hotReload: boolean = true) {
  const [data, setData] = useState<AreaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [switching, setSwitching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<string | null>(null);
  const baseAreaDataRef = useRef<AreaData | null>(null);

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
        
        // Immediately fetch and merge with Google Sheets data
        await mergeWithSheetData();
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

  const mergeWithSheetData = async () => {
    if (!baseAreaDataRef.current) {
      console.log('⚠️ No base area data to merge with');
      return;
    }
    
    try {
      console.log(`🔗 Fetching and merging Google Sheets data for ${areaId}:`);
      
      // Fetch fresh data from Google Sheets
      const boothStatuses = await fetchBoothStatusFromSheets();
      
      console.log(`📋 Fetched ${boothStatuses.size} entries from Google Sheets`);
      console.log(`🏢 Base data has ${baseAreaDataRef.current.booths.length} booths`);
      
      // Merge booth statuses from Google Sheets with base area data
      const updatedAreaData: AreaData = {
        ...baseAreaDataRef.current,
        booths: baseAreaDataRef.current.booths.map((booth, index) => {
          // Google Sheets data has PRIORITY over local JSON
          const sheetStatus = boothStatuses.get(booth.id);
          const finalStatus = sheetStatus !== undefined ? sheetStatus : booth.status;
          
          console.log(`🔄 [${index}] ${booth.id}: "${booth.status}" (local) + "${sheetStatus}" (sheet) → "${finalStatus}"`);
          
          return {
            ...booth,
            status: finalStatus,
            // Update color based on status
            color: getColorForStatus(finalStatus)
          };
        })
      };
      
      console.log('✅ Data merged, updating state');
      setData(updatedAreaData);
    } catch (error) {
      console.error('❌ Error fetching/merging sheet data:', error);
      // Fallback to base data if sheets fail
      setData(baseAreaDataRef.current);
    }
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

    // Set up polling for both JSON and Google Sheets (every 10 seconds)
    if (hotReload && process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(async () => {
        // Reload JSON data
        await loadBaseAreaData(false);
        // Fresh sheet data is fetched as part of loadBaseAreaData now
      }, 10000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, hotReload]);

  return { data, loading: loading || switching, error };
}