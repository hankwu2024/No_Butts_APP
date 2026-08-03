export interface Hotspot {
  id: string;
  address: string;
  count: number;
  note: string;
}

export interface ScreeningData {
  id?: string;
  recordId: string;
  date: string;
  cityCode: string;
  recorderName: string;
  screenerName: string;
  photographerName: string;
  startAddress: string;
  endAddress: string;
  direction: 'right' | 'left';
  screenedCount: number;
  actualPickedCount: number;
  boxCount: number;
  drainCount: number;
  note: string;
  photoCount: number;
  images: string[];
  path?: { lat: number; lng: number; timestamp: number }[];
  distance?: number;
  hotspots: Hotspot[];
  method: 'walk' | 'bike' | 'motor';
  roadType: 'complex' | 'normal' | 'road_only';
  userId: string;
  createdAt?: any;
  created?: string;
}

export type SortField = 'date' | 'actualPickedCount' | 'screenedCount' | 'recordId';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  city: string;
  dateStart: string;
  dateEnd: string;
  address: string;
  recordId: string;
  personnel: string;
}

export interface SortState {
  field: SortField;
  direction: SortDirection;
}
