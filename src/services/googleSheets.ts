import { BoothStatus } from '../types/booth';
import { Booth } from '../types/booth';

// URLs for different Google Sheets via sheetjson.com
const SHEET_URLS = {
  // MainExhibitionHall (OTD TechDays 2026)
  techDays: 'https://sheetjson.com/spreadsheets/d/1nJL3jkJCrJZy2acn60bZeVYXmw4m_wa6An68Oqjb8ds?gid=0',
  // All OTD Energy 2027 areas (Hall_B_2, Hall_C, Hall_E_3, all_in_one)
  energy: 'https://sheetjson.com/spreadsheets/d/18ib8qaAeBJtlVKJN6xmyCLfyD_9LLvyojxGFMl-jvYY?gid=0'
};

// Function to get the correct sheet URL based on areaId
const getSheetUrlForArea = (areaId: string): string => {
  switch (areaId) {
    case 'MainExhibitionHall':
      return SHEET_URLS.techDays;
    case 'Hall_B_2':
    case 'Hall_C':
    case 'Hall_E_3':
    case 'all_in_one':
    default:
      return SHEET_URLS.energy;
  }
};

// Add test function to window for manual testing
(window as any).testSheetJson = async (areaId: string = 'energy') => {
  try {
    console.log(`🧪 Testing sheetjson.com URL for area: ${areaId}`);
    const sheetUrl = getSheetUrlForArea(areaId);
    const cacheBustUrl = `${sheetUrl}&_=${Date.now()}`;
    console.log('🧪 Cache-bust URL:', cacheBustUrl);
    
    const response = await fetch(cacheBustUrl);
    const data = await response.json();
    console.log('🧪 Test result:', data);
    console.log('🧪 First few items:', JSON.stringify(data.slice(0, 5), null, 2));
    return data;
  } catch (error) {
    console.error('🧪 Test failed:', error);
  }
};

// Convert Google Sheets status to our internal status format
const normalizeStatus = (sheetStatus: string): BoothStatus => {
  const status = sheetStatus.toLowerCase();
  switch (status) {
    case 'sold':
      return 'sold';
    case 'reserved':
      return 'reserved';
    case 'available':
    default:
      return 'available';
  }
};

// Helper function to safely get string value from sheet cell
const getStringValue = (value: any, fallback: string = ''): string => {
  if (value === null || value === undefined || value === 'undefined') {
    return fallback;
  }
  return String(value).trim();
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

// Fetch complete booth information from Google Sheets using sheetjson.com API
// Returns a map of booth ID to complete booth data
export async function fetchBoothInfoFromSheets(areaId: string): Promise<Map<string, Booth>> {
  const boothMap = new Map<string, Booth>();
  
  try {
    // Get the correct sheet URL for this area
    const sheetUrl = getSheetUrlForArea(areaId);
    // Add cache-busting timestamp to ensure fresh data
    const cacheBustUrl = `${sheetUrl}&_=${Date.now()}`;
    console.log(`🌐 Fetching from URL for area ${areaId} with cache-bust:`, cacheBustUrl);
    
    const response = await fetch(cacheBustUrl);
    console.log('📡 Response status:', response.status, response.statusText);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    console.log('📊 FULL Raw Sheet JSON data from sheetjson.com:', jsonData);
    console.log('📊 Data type:', typeof jsonData);
    console.log('📊 Array length:', jsonData.length);
    console.log('📊 First few items:', JSON.stringify(jsonData.slice(0, 5), null, 2));
    
    // Process each row from the sheet
    jsonData.forEach((row: any, index: number) => {
      const id = getStringValue(row.id);
      
      if (id) {
        // Extract all available booth information from the sheet
        const status = getStringValue(row.status) || 'Available';
        const name = getStringValue(row.name); // Default name
        const width = parseFloat(getStringValue(row.width)) || 0;
        const height = parseFloat(getStringValue(row.lenght)) || 0; // Note: API has "lenght" typo
        const area = parseFloat(getStringValue(row.area)) || 0;
        
        // Handle status normalization
        const isEmptyStatus = !status || status === 'undefined' || status === undefined || status.trim() === '';
        const normalizedStatus = isEmptyStatus ? 'nil' : normalizeStatus(status);
        
        // Create complete booth object
        const booth: Booth = {
          id,
          name,
          width,
          height,
          area,
          status: normalizedStatus,
          color: getColorForStatus(normalizedStatus)
        };
        
        console.log(`🏢 [${index}] Processing booth: ${id}`, {
          status: `"${status}" → ${normalizedStatus}`,
          name,
          dimensions: `${width} × ${height}`,
          totalArea: area
        });
        
        boothMap.set(id, booth);
      } else {
        console.warn(`⚠️ [${index}] Row missing ID:`, row);
      }
    });
    
    console.log('🗂️ Final booth information map:', Array.from(boothMap.entries()));
    
    console.log(`📊 Loaded ${boothMap.size} booth information entries from Google Sheets`);
    return boothMap;
    
  } catch (error) {
    console.error('Error fetching booth status from Google Sheets:', error);
    // Return empty map on error - will fall back to JSON file status
    return new Map();
  }
}

