import { create } from 'zustand';
import type { CuratedFire } from '@/features/fires/data/curated-fires';
import { LATEST_CONSUMER_IMPACT_DATE } from '@/features/impact/data/consumer-impact';

export interface FireFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    latitude: number;
    longitude: number;
    bright_ti4: number;
    frp: number;
    confidence: string;
    acq_date: string;
    acq_time: string;
    satellite: string;
    daynight: string;
    intensity: 'low' | 'medium' | 'high' | 'extreme';
    estimatedCO2TonsDay: number;
    matchedFacility?: {
      id: string;
      name: string;
      facilityType: string;
      capacityBPD: number;
      country: string;
      status: string;
      newsSourceUrl?: string;
      description: string;
      percentGlobalCapacity: number;
    } | null;
  };
}

export interface FireGeoJSON {
  type: 'FeatureCollection';
  features: FireFeature[];
}

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapState {
  center: [number, number];
  zoom: number;
}

interface LayerToggles {
  heatmap: boolean;
  markers: boolean;
  facilities: boolean;
}

const TIMELINE_DATE_STORAGE_KEY = 'obt-timeline-date';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimelineDate(value: string | null): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  return value >= '2023-10-07' && value <= '2035-12-31';
}

interface FireStore {
  fireData: FireGeoJSON;
  fireDataSource: 'live' | 'snapshot' | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  mapState: MapState;
  pendingFlyTo: FlyToTarget | null;
  layers: LayerToggles;

  selectedFacility: CuratedFire | null;
  /** Deterministic on SSR/initial hydration; hydrated to sessionStorage or today on mount. */
  timelineDate: string;
  /** Tracks which UI initiated the last timelineDate update so feed & scrubber stay in sync without loops. */
  timelineDateSource: 'init' | 'scrubber' | 'feed' | 'map';
  timelineHydrated: boolean;
  isMuted: boolean;
  mapMode: boolean;

  setFireData: (data: FireGeoJSON, source?: 'live' | 'snapshot') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastUpdated: (date: Date) => void;

  setSelectedFacility: (facility: CuratedFire | null) => void;
  setTimelineDate: (date: string, source?: 'scrubber' | 'feed' | 'map') => void;
  hydrateTimelineDate: () => void;
  setIsMuted: (muted: boolean) => void;
  setMapMode: (mapMode: boolean) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setPendingFlyTo: (target: FlyToTarget | null) => void;
  toggleLayer: (layer: keyof LayerToggles) => void;
}

export const useFireStore = create<FireStore>((set, get) => ({
  fireData: { type: 'FeatureCollection', features: [] },
  fireDataSource: null,
  loading: false,
  error: null,
  lastUpdated: null,

  mapState: {
    center: [47.5, 29.0],
    zoom: 5
  },
  pendingFlyTo: null,

  layers: {
    heatmap: true,
    markers: true,
    facilities: true
  },

  selectedFacility: null,
  // Deterministic value at bundle time prevents static-export hydration mismatches;
  // TimelineDataLoader hydrates to sessionStorage or client today on mount.
  timelineDate: LATEST_CONSUMER_IMPACT_DATE,
  timelineDateSource: 'init',
  timelineHydrated: false,
  isMuted: true,
  mapMode: false,

  setFireData: (data, source) =>
    set((state) => ({
      fireData: data,
      fireDataSource: source ?? state.fireDataSource
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLastUpdated: (date) => set({ lastUpdated: date }),

  setSelectedFacility: (facility) => set({ selectedFacility: facility }),
  setTimelineDate: (date, source = 'scrubber') => {
    if (!isValidTimelineDate(date)) return;
    try {
      sessionStorage.setItem(TIMELINE_DATE_STORAGE_KEY, date);
    } catch {}
    set({ timelineDate: date, timelineDateSource: source });
  },
  hydrateTimelineDate: () => {
    if (get().timelineHydrated || typeof window === 'undefined') return;
    const todayIso = new Date().toISOString().slice(0, 10);
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(TIMELINE_DATE_STORAGE_KEY);
    } catch {}
    const resolved =
      isValidTimelineDate(stored) && stored <= todayIso ? stored : todayIso;
    set({
      timelineDate: resolved,
      timelineDateSource: 'init',
      timelineHydrated: true
    });
  },
  setIsMuted: (muted) => set({ isMuted: muted }),
  setMapMode: (mapMode) => set({ mapMode }),

  setMapCenter: (center) =>
    set((state) => ({
      mapState: { ...state.mapState, center }
    })),

  setMapZoom: (zoom) =>
    set((state) => ({
      mapState: { ...state.mapState, zoom }
    })),

  setPendingFlyTo: (target) => set({ pendingFlyTo: target }),

  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] }
    }))
}));
