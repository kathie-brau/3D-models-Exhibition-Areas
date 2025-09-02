import { useState, useEffect, useRef } from 'react';
import { AreaData } from '../types/booth';

export function useAreaData(areaId: string, hotReload: boolean = true) {
  const [data, setData] = useState<AreaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<string | null>(null);

  const loadAreaData = async () => {
    try {
      setError(null);
      
      const response = await fetch(`/data/${areaId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load ${areaId} data`);
      }
      
      const lastModified = response.headers.get('last-modified');
      const areaData: AreaData = await response.json();
      
      // Only update data if it's actually changed
      if (!lastModifiedRef.current || lastModified !== lastModifiedRef.current) {
        setData(areaData);
        lastModifiedRef.current = lastModified;
        console.log(`🔄 Area ${areaId} data reloaded at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error loading area data for ${areaId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!areaId) return;

    // Initial load
    setLoading(true);
    loadAreaData();

    // Set up hot reload polling (every 2 seconds in development)
    if (hotReload && process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(() => {
        loadAreaData();
      }, 2000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [areaId, hotReload]);

  return { data, loading, error };
}