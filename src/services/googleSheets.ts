import { BoothStatus } from '../types/booth';

// Direct URL for the Google Sheet via sheetjson.com
const SHEET_JSON_URL = 'https://sheetjson.com/spreadsheets/d/1SnWgzxlIr0R8gxCdnv0bMdHFv2RdJjwrr2zDiEkIv3g?gid=0';

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
    const response = await fetch(SHEET_JSON_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    console.log('📊 Sheet JSON data:', jsonData.slice(0, 3)); // Debug first 3 items
    
    // Process each row from the sheet
    jsonData.forEach((row: any) => {
      const id = row.ID;
      const status = row.Status;
      
      if (id) {
        // Google Sheets data has priority - even if status is empty, we set it to 'nil'
        const normalizedStatus = status ? normalizeStatus(status) : 'nil';
        console.log(`🏢 Processing booth: ${id} = ${normalizedStatus} (from sheets)`);
        statusMap.set(id, normalizedStatus);
      }
    });
    
    console.log(`📊 Loaded ${statusMap.size} booth statuses from Google Sheets`);
    return statusMap;
    
  } catch (error) {
    console.error('Error fetching booth status from Google Sheets:', error);
    // Return empty map on error - will fall back to JSON file status
    return new Map();
  }
}

