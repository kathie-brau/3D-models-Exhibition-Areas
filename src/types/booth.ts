export type BoothStatus = 'sold' | 'reserved' | 'available' | 'nil';

export interface Booth {
  id: string;
  name: string;
  x: string;
  y: string;
  width: string;
  height: string;
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
  areaName: string;
  rootDimensions: RootDimensions;
  booths: Booth[];
  stages: Stage[];
}

export interface StatusColors {
  sold: number;
  reserved: number;
  available: number;
  nil: number;
}