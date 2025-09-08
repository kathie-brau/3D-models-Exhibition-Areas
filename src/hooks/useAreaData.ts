import { useState, useEffect, useRef } from 'react';
import { AreaData } from '../types/booth';
import { fetchBoothInfoFromSheets } from '../services/googleSheets';

export function useAreaData(areaId: string, hotReload: boolean = true) {
  const [data, setData] = useState<AreaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string | null>(null);

  const loadAreaDataFromSheets = async () => {
    try {
      setError(null);
      setLoading(true);
      
      console.log(`📈 Loading booth data from Google Sheets for area: ${areaId}`);
      
      // Fetch all booth data from Google Sheets
      const boothMap = await fetchBoothInfoFromSheets();
      
      // Filter booths by area based on booth ID prefix
      // B-xxxx → Hall_B_2, C-xxxx → Hall_C, E-xxxx → Hall_E_3
      // MainExhibitionHall → Show all booths (different event)
      let boothPrefix = '';
      switch (areaId) {
        case 'Hall_B_2':
          boothPrefix = 'B-';
          break;
        case 'Hall_C':
          boothPrefix = 'C-';
          break;
        case 'Hall_E_3':
          boothPrefix = 'E-';
          break;
        case 'MainExhibitionHall':
          boothPrefix = ''; // Show all booths for MainExhibitionHall
          break;
      }
      
      const allBooths = Array.from(boothMap.values());
      const filteredBooths = boothPrefix ? 
        allBooths.filter(booth => booth.id.startsWith(boothPrefix)) : 
        allBooths;
      
      // Determine area name based on areaId
      let areaName = 'Exhibition Area';
      switch (areaId) {
        case 'Hall_C':
          areaName = 'Exhibition Hall C';
          break;
        case 'Hall_B_2':
          areaName = 'Exhibition Hall B';
          break;
        case 'Hall_E_3':
          areaName = 'Exhibition Hall E';
          break;
        case 'MainExhibitionHall':
          areaName = 'Main Exhibition Hall';
          break;
      }
      
      console.log(`🏢 Found ${filteredBooths.length} booths for area ${areaName} (prefix: ${boothPrefix || 'none'})`);
      
      // Create area data structure
      const areaData: AreaData = {
        areaId,
        areaName,
        booths: filteredBooths
      };
      
      // Create a hash of the data to detect actual changes
      const dataHash = JSON.stringify({
        areaId: areaData.areaId,
        areaName: areaData.areaName,
        booths: areaData.booths.map(booth => ({
          id: booth.id,
          name: booth.name,
          status: booth.status,
          color: booth.color,
          width: booth.width,
          height: booth.height,
          area: booth.area
        }))
      });
      
      // Only update state if data has actually changed
      if (dataHash !== lastDataHashRef.current) {
        console.log(`🔄 Area data changed, updating state`);
        lastDataHashRef.current = dataHash;
        setData(areaData);
      } else {
        console.log(`⏭️ Area data unchanged, skipping state update`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error loading area data for ${areaId}:`, err);
    } finally {
      setLoading(false);
    }
  };


  // Load area data on mount and when area changes
  useEffect(() => {
    if (!areaId) return;

    // Load initial data
    loadAreaDataFromSheets();

    // Set up polling for Google Sheets data (every 10 seconds in development)
    if (hotReload && process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(async () => {
        await loadAreaDataFromSheets();
      }, 100000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, hotReload]);

  return { data, loading, error };
}