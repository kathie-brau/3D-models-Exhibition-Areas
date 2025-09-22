import { useState, useEffect, useRef } from 'react';
import { AreaData } from '../types/booth';
import { fetchBoothInfoFromSheets } from '../services/googleSheets';

export function useAreaData(areaId: string, hotReload: boolean = true) {
  const [data, setData] = useState<AreaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string | null>(null);

  // Determine event type to avoid reloading data for individual halls
  const getEventType = (areaId: string): string => {
    if (areaId === 'MainExhibitionHall') {
      return 'techdays'; // OTD Tech Days 2026
    }
    // All energy areas use the same data
    return 'energy'; // OTD Energy 2027
  };

  const loadAreaDataFromSheets = async () => {
    try {
      setError(null);
//      setLoading(true);
      
      const eventType = getEventType(areaId);
      console.log(`📈 Loading booth data for event: ${eventType} (requested area: ${areaId})`);
      
      // Use areaId for sheet selection, but eventType for data caching
      const boothMap = await fetchBoothInfoFromSheets(areaId);
      
      // For Energy 2027 areas, show ALL energy booths on the combined model
      // For MainExhibitionHall, show only its booths
      const isEnergyArea = ['Hall_B_2', 'Hall_C', 'Hall_E_3', 'all_in_one'].includes(areaId);
      
      const allBooths = Array.from(boothMap.values());
      let filteredBooths;
      
      if (isEnergyArea) {
        // For any energy area, show ALL energy booths (B-, C-, E-)
        filteredBooths = allBooths.filter(booth => 
          booth.id.startsWith('B-') || 
          booth.id.startsWith('C-') || 
          booth.id.startsWith('E-')
        );
        console.log(`🌍 Energy area selected: showing combined booth data from all energy halls`);
      } else {
        // For MainExhibitionHall, show all booths from that event
        filteredBooths = allBooths;
        console.log(`🏗️ MainExhibitionHall selected: showing all booths from that event`);
      }
      
      // Determine area name based on areaId
      let areaName = 'Exhibition Area';
      switch (areaId) {
        case 'all_in_one':
          areaName = 'Exhibition OTD Energy';
          break;
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
      
      console.log(`🏢 Found ${filteredBooths.length} booths for area ${areaName}`);
      if (isEnergyArea) {
        console.log(`  → Combined data from Hall B, C, and E`);
      }
      
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


  // Get current event type to track changes
  const currentEventType = getEventType(areaId);

  // Load area data on mount and when EVENT TYPE changes (not individual areas)
  useEffect(() => {
    if (!areaId) return;

    console.log(`🔄 Event type: ${currentEventType} for area: ${areaId}`);

    // Load initial data
    loadAreaDataFromSheets();

    // Set up polling for Google Sheets data (every 10 seconds in development)
    if (hotReload && process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(async () => {
        await loadAreaDataFromSheets();
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventType, hotReload]); // Only reload when event type changes

  return { data, loading, error };
}