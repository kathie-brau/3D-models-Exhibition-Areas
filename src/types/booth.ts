export type BoothStatus = 'sold' | 'reserved' | 'available' | 'nil';

export interface Booth {
  id: string; // Booth ID that corresponds to 3D model components
  name: string;
  width: number;
  height: number; // Length from sheets (note: API has "lenght" typo)
  area: number; // Total area from sheets
  status: BoothStatus;
  color: string;
}

export interface Stage {
  id: string;
  name: string;
  x: string;
  y: string;
  width: string;
  height: string;
  color: string;
}

export interface RootDimensions {
  width: string;
  height: string;
}

export interface AreaData {
  areaId: string; // Area ID for 3D model loading (Hall_B_2, Hall_C, Hall_E_3)
  areaName: string;
  booths: Booth[];
  // Note: rootDimensions and stages are now handled by 3D models
}

export interface StatusColors {
  sold: number;
  reserved: number;
  available: number;
  nil: number;
}