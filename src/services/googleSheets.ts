import { BoothStatus } from '../types/booth';

// Direct URL for the Google Sheet via sheetjson.com
const SHEET_JSON_URL = 'https://sheetjson.com/spreadsheets/d/1SnWgzxlIr0R8gxCdnv0bMdHFv2RdJjwrr2zDiEkIv3g?gid=0';

// Add test function to window for manual testing
(window as any).testSheetJson = async () => {
  try {
    console.log('🧪 Testing sheetjson.com URL directly...');
    const cacheBustUrl = `${SHEET_JSON_URL}&_=${Date.now()}`;
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

// Fetch booth status data from Google Sheets using sheetjson.com API
export async function fetchBoothStatusFromSheets(): Promise<Map<string, BoothStatus>> {
  const statusMap = new Map<string, BoothStatus>();
  
  try {
    // Add cache-busting timestamp to ensure fresh data
    const cacheBustUrl = `${SHEET_JSON_URL}&_=${Date.now()}`;
    console.log('🌐 Fetching from URL with cache-bust:', cacheBustUrl);
    
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
      const id = row.ID;
      const status = row.Status;
      
      if (id) {
        // Google Sheets data has priority - even if status is empty, we set it to 'nil'
        // Handle both undefined and the string "undefined" from empty cells
        const isEmptyStatus = !status || status === 'undefined' || status === undefined || (typeof status === 'string' && status.trim() === '');
        const normalizedStatus = isEmptyStatus ? 'nil' : normalizeStatus(status);
        console.log(`🏢 [${index}] Processing booth: ${id} = "${status}" → ${normalizedStatus}`);
        statusMap.set(id, normalizedStatus);
      } else {
        console.warn(`⚠️ [${index}] Row missing ID:`, row);
      }
    });
    
    console.log('🗂️ Final status map:', Array.from(statusMap.entries()));
    
    console.log(`📊 Loaded ${statusMap.size} booth statuses from Google Sheets`);
    return statusMap;
    
  } catch (error) {
    console.error('Error fetching booth status from Google Sheets:', error);
    // Return empty map on error - will fall back to JSON file status
    return new Map();
  }
}

