'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  Popup,
  setWorkerUrl,
  type StyleSpecification,
  type GeoJSONSource
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre v6 resolves its module worker relative to import.meta.url, which breaks
// when Next.js Turbopack bundles maplibre-gl into /_next/static/chunks/*.js.
// Point explicitly at the version-synced static worker copied by scripts/sync-maplibre-worker.js.
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.js');
}
import { useFireStore, type FireGeoJSON } from '@/stores/fire-store';
import {
  curatedFires,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap,
  type FacilityFireStats,
  type FacilityStatus
} from '@/features/fires/data/curated-fires';
import {
  getEventsUpTo,
  CATEGORY_COLORS,
  type ConflictEvent
} from '@/features/timeline/data/conflict-events';
import { useEventsStore } from '@/stores/events-store';
import {
  buildEventPopupHtml,
  buildFacilityPopupHtml,
  buildFirePopupHtml,
  getYouTubeId
} from '@/features/map/utils/popup-html';

// Free satellite tiles — no API key needed
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Satellite + Terrain',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxzoom: 19
    },
    'terrain-dem': {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 15
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19
    }
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite'
    },
    {
      id: 'labels-layer',
      type: 'raster',
      source: 'labels',
      paint: {
        'raster-opacity': 0.7
      }
    }
  ],
  terrain: {
    source: 'terrain-dem',
    exaggeration: 1.5
  },
  sky: {
    'sky-color': '#0a0a1a',
    'sky-horizon-blend': 0.1,
    'horizon-color': '#111133',
    'horizon-fog-blend': 0.5,
    'fog-color': '#0a0a1a',
    'fog-ground-blend': 0.8
  }
};

const STATUS_COLORS: Record<FacilityStatus, string> = {
  active_fire: '#ef4444',
  damaged: '#f97316',
  monitoring: '#eab308',
  offline: '#6b7280',
  operational: '#22c55e'
};

// Capacity label: show BPD or BCF/day or storage
function capacityLabel(f: (typeof curatedFires)[0]): string {
  if (f.capacityBPD >= 1000000)
    return `${(f.capacityBPD / 1000000).toFixed(1)}M BPD`;
  if (f.capacityBPD > 0) return `${(f.capacityBPD / 1000).toFixed(0)}K BPD`;
  if (f.gasCapacityBCFD) return `${f.gasCapacityBCFD} BCF/d`;
  if (f.storageMBBL) return `${f.storageMBBL}M bbl`;
  return '';
}

// Impact radius scales with percentGlobalCapacity
// bigger facilities = bigger glow on the map
function impactScale(pct: number): number {
  if (pct >= 20) return 6; // Hormuz-level
  if (pct >= 5) return 5; // Abqaiq, Kharg
  if (pct >= 2) return 4; // South Pars, Ghawar
  if (pct >= 1) return 3; // Ras Laffan, Rumaila
  if (pct >= 0.3) return 2; // Most refineries
  return 1; // Small facilities
}

function buildFacilitiesGeoJSON(
  timelineDate: string,
  facilityStats: Map<string, FacilityFireStats>
) {
  return {
    type: 'FeatureCollection' as const,
    features: curatedFires.map((f) => {
      const effectiveStatus = getEffectiveFacilityStatus(
        f,
        timelineDate,
        facilityStats.get(f.id)?.maxFRP ?? 0
      );
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [f.lng, f.lat] as [number, number]
        },
        properties: {
          id: f.id,
          name: f.name,
          capacityText: capacityLabel(f),
          labelText: f.name.length > 22 ? f.name.slice(0, 20) + '...' : f.name,
          facilityType: f.facilityType,
          status: effectiveStatus,
          country: f.country,
          percentGlobalCapacity: f.percentGlobalCapacity,
          color: STATUS_COLORS[effectiveStatus],
          impactScale: impactScale(f.percentGlobalCapacity),
          isActive:
            effectiveStatus === 'active_fire' || effectiveStatus === 'damaged'
              ? 1
              : 0,
          threatLevel: f.threatLevel
        }
      };
    })
  };
}

function buildEventsGeoJSON(events: ConflictEvent[]) {
  return {
    type: 'FeatureCollection' as const,
    features: events
      .filter((e) => e.lat && e.lng)
      .map((e) => {
        const ytMedia = e.mediaUrls?.find((m) => m.type === 'youtube');
        const videoId = ytMedia ? getYouTubeId(ytMedia.url) : null;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [e.lng!, e.lat!] as [number, number]
          },
          properties: {
            id: e.id,
            title: e.title,
            description: e.description.slice(0, 200),
            category: e.category,
            date: e.date,
            color: CATEGORY_COLORS[e.category],
            videoId: videoId || '',
            videoLabel: ytMedia?.label || '',
            hasVideo: videoId ? 1 : 0,
            killed: e.casualties?.killed || 0,
            displaced: e.casualties?.displaced || 0,
            sourceUrl: e.sourceUrl || ''
          }
        };
      })
  };
}

function attachPopupMuteHandler(popupInstance: Popup) {
  const el = popupInstance.getElement();
  const btn = el?.querySelector<HTMLButtonElement>('.obt-yt-mute-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const iframeId = btn.dataset.ytIframe;
    if (!iframeId) return;
    const iframe = el.querySelector<HTMLIFrameElement>(
      `iframe[id="${CSS.escape(iframeId)}"]`
    );
    if (!iframe?.contentWindow) return;
    const wasMuted = btn.dataset.muted !== 'false';
    const cmd = wasMuted ? 'unMute' : 'mute';
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }),
      'https://www.youtube-nocookie.com'
    );
    const nextMuted = !wasMuted;
    btn.dataset.muted = String(nextMuted);
    btn.textContent = nextMuted
      ? '\ud83d\udd07 Muted'
      : '\ud83d\udd0a Sound On';
    useFireStore.getState().setIsMuted(nextMuted);
  });
}

function applyLayerVisibility(
  m: MapLibreMap,
  layers: { heatmap: boolean; markers: boolean; facilities: boolean }
) {
  try {
    m.setLayoutProperty(
      'fires-heat',
      'visibility',
      layers.heatmap ? 'visible' : 'none'
    );
    const mv = layers.markers ? 'visible' : 'none';
    m.setLayoutProperty('fires-glow', 'visibility', mv);
    m.setLayoutProperty('fires-smoke', 'visibility', mv);
    m.setLayoutProperty('fires-points', 'visibility', mv);
    const fv = layers.facilities ? 'visible' : 'none';
    m.setLayoutProperty('facility-impact-glow', 'visibility', fv);
    m.setLayoutProperty('facility-mid-ring', 'visibility', fv);
    m.setLayoutProperty('facility-core', 'visibility', fv);
    m.setLayoutProperty('facility-labels', 'visibility', fv);
    m.setLayoutProperty('facility-status', 'visibility', fv);
  } catch {}
}

export default function FireMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const mapLoadedRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const animSyncRef = useRef<(() => void) | null>(null);
  const animCleanupRef = useRef<(() => void) | null>(null);

  const fireData = useFireStore((s) => s.fireData);
  const layers = useFireStore((s) => s.layers);
  const timelineDate = useFireStore((s) => s.timelineDate);
  const pendingFlyTo = useFireStore((s) => s.pendingFlyTo);
  const setPendingFlyTo = useFireStore((s) => s.setPendingFlyTo);
  const setMapCenter = useFireStore((s) => s.setMapCenter);
  const setMapZoom = useFireStore((s) => s.setMapZoom);
  const isMuted = useFireStore((s) => s.isMuted);
  const isMutedRef = useRef(isMuted);
  const events = useEventsStore((s) => s.events);

  const facilityStats = useMemo(
    () => getFacilityFireStatsMap(fireData.features, timelineDate),
    [fireData.features, timelineDate]
  );

  // The 'load' handler runs once with a first-render closure; without a ref it
  // would seed the fires source with stale (empty) data when the fetch
  // resolves before the map finishes loading. The refs are written in an
  // effect (not during render) so the map callbacks always read fresh values.
  const fireDataRef = useRef(fireData);
  const eventsRef = useRef(events);
  const layersRef = useRef(layers);
  const timelineDateRef = useRef(timelineDate);
  const facilityStatsRef = useRef(facilityStats);
  useEffect(() => {
    isMutedRef.current = isMuted;
    fireDataRef.current = fireData;
    eventsRef.current = events;
    layersRef.current = layers;
    timelineDateRef.current = timelineDate;
    facilityStatsRef.current = facilityStats;
    // Fires layer or active fire count changed → start/stop pulse animation
    animSyncRef.current?.();
  }, [isMuted, fireData, events, layers, timelineDate, facilityStats]);

  const initMap = useCallback(() => {
    if (!mapContainer.current || map.current) return;

    const { center, zoom } = useFireStore.getState().mapState;
    map.current = new MapLibreMap({
      container: mapContainer.current,
      style: SATELLITE_STYLE,
      center,
      zoom,
      pitch: 45,
      bearing: -10,
      maxPitch: 85,
      attributionControl: false
    });

    map.current.addControl(
      new NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );
    map.current.addControl(
      new AttributionControl({ compact: true }),
      'bottom-left'
    );

    map.current.on('load', () => {
      if (!map.current) return;
      const m = map.current;
      mapLoadedRef.current = true;

      // ── FIRMS fire data source (only fires near oil facilities active at timelineDate) ──
      const facilityFires: FireGeoJSON = {
        type: 'FeatureCollection',
        features: fireDataRef.current.features.filter((f) => {
          const id = f.properties.matchedFacility?.id;
          return Boolean(id && facilityStatsRef.current.has(id));
        })
      };
      m.addSource('fires', {
        type: 'geojson',
        data: facilityFires
      });

      // Heatmap layer
      m.addLayer({
        id: 'fires-heat',
        type: 'heatmap',
        source: 'fires',
        maxzoom: 12,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'frp'],
            0,
            0,
            10,
            0.3,
            50,
            0.6,
            200,
            1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            1,
            12,
            3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.2,
            'rgba(255,255,0,0.4)',
            0.4,
            'rgba(255,165,0,0.6)',
            0.6,
            'rgba(255,69,0,0.8)',
            0.8,
            'rgba(255,0,0,0.9)',
            1,
            'rgba(183,28,28,1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            15,
            6,
            30,
            12,
            50
          ],
          'heatmap-opacity': 0.8
        }
      });

      // FIRMS fire points — outer glow (intensity-colored)
      m.addLayer({
        id: 'fires-glow',
        type: 'circle',
        source: 'fires',
        minzoom: 4,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              8,
              'high',
              7,
              'medium',
              6,
              5
            ],
            8,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              14,
              'high',
              12,
              'medium',
              10,
              8
            ],
            12,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              20,
              'high',
              16,
              'medium',
              13,
              10
            ]
          ],
          'circle-color': [
            'match',
            ['get', 'intensity'],
            'extreme',
            '#B71C1C',
            'high',
            '#F44336',
            'medium',
            '#FF9800',
            '#FFEB3B'
          ],
          'circle-opacity': 0.35,
          'circle-blur': 0.8
        }
      });

      // Smoke haze — large, soft, drifting upward effect
      m.addLayer({
        id: 'fires-smoke',
        type: 'circle',
        source: 'fires',
        minzoom: 5,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              18,
              'high',
              14,
              'medium',
              10,
              8
            ],
            8,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              30,
              'high',
              24,
              'medium',
              18,
              14
            ],
            12,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              45,
              'high',
              35,
              'medium',
              28,
              20
            ]
          ],
          'circle-color': '#555',
          'circle-opacity': 0.15,
          'circle-blur': 1,
          'circle-translate': [0, -3] as [number, number]
        }
      });

      // FIRMS fire points — solid core dot
      m.addLayer({
        id: 'fires-points',
        type: 'circle',
        source: 'fires',
        minzoom: 4,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              4,
              'high',
              3.5,
              'medium',
              3,
              2.5
            ],
            8,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              7,
              'high',
              6,
              'medium',
              5,
              4
            ],
            12,
            [
              'match',
              ['get', 'intensity'],
              'extreme',
              10,
              'high',
              8,
              'medium',
              7,
              5
            ]
          ],
          'circle-color': [
            'match',
            ['get', 'intensity'],
            'extreme',
            '#B71C1C',
            'high',
            '#F44336',
            'medium',
            '#FF9800',
            '#FFEB3B'
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.6)'
        }
      });

      // ── Curated facility markers (scaled by impact) ──
      m.addSource('facilities', {
        type: 'geojson',
        data: buildFacilitiesGeoJSON(
          timelineDateRef.current,
          facilityStatsRef.current
        )
      });

      // Layer 1: Outer impact glow — large, faded, shows area of effect
      // Scales with percentGlobalCapacity via impactScale property
      m.addLayer({
        id: 'facility-impact-glow',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            ['*', ['get', 'impactScale'], 6],
            6,
            ['*', ['get', 'impactScale'], 14],
            10,
            ['*', ['get', 'impactScale'], 25]
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.12,
          'circle-blur': 1
        }
      });

      // Layer 2: Mid ring — intermediate glow
      m.addLayer({
        id: 'facility-mid-ring',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            ['*', ['get', 'impactScale'], 3.5],
            6,
            ['*', ['get', 'impactScale'], 8],
            10,
            ['*', ['get', 'impactScale'], 14]
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
          'circle-blur': 0.6
        }
      });

      // Layer 3: Inner core — solid center dot
      m.addLayer({
        id: 'facility-core',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            ['*', ['get', 'impactScale'], 1.8],
            6,
            ['*', ['get', 'impactScale'], 3.5],
            10,
            ['*', ['get', 'impactScale'], 5.5]
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': ['case', ['==', ['get', 'isActive'], 1], 2, 1],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'isActive'], 1],
            '#ffffff',
            'rgba(255,255,255,0.5)'
          ]
        }
      });

      // Facility name + capacity labels (combined)
      m.addLayer({
        id: 'facility-labels',
        type: 'symbol',
        source: 'facilities',
        minzoom: 4,
        layout: {
          'text-field': [
            'case',
            ['!=', ['get', 'capacityText'], ''],
            ['concat', ['get', 'labelText'], '\n', ['get', 'capacityText']],
            ['get', 'labelText']
          ],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            9,
            7,
            11,
            10,
            13
          ],
          'text-offset': [0, 2.2] as [number, number],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': false,
          'text-optional': true,
          'text-max-width': 14,
          'text-line-height': 1.3
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.85)',
          'text-halo-width': 1.5
        }
      });

      // Status badge labels (FIRE / DMG) — only for active/damaged
      m.addLayer({
        id: 'facility-status',
        type: 'symbol',
        source: 'facilities',
        minzoom: 4,
        filter: ['==', ['get', 'isActive'], 1],
        layout: {
          'text-field': [
            'case',
            ['==', ['get', 'status'], 'active_fire'],
            'FIRE',
            ['==', ['get', 'status'], 'damaged'],
            'DAMAGED',
            ''
          ],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 10],
          'text-offset': [0, -2.2] as [number, number],
          'text-anchor': 'bottom',
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5
        }
      });

      // ── Conflict event pins (synced to timeline) ──
      m.addSource('conflict-events', {
        type: 'geojson',
        data: buildEventsGeoJSON(
          getEventsUpTo(eventsRef.current, timelineDateRef.current)
        )
      });

      // Outer glow ring for event pins
      m.addLayer({
        id: 'event-pin-ring',
        type: 'circle',
        source: 'conflict-events',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            12,
            6,
            22,
            10,
            35
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
          'circle-blur': 0.6
        }
      });

      // Core pin marker — large and visible
      m.addLayer({
        id: 'event-pin-core',
        type: 'circle',
        source: 'conflict-events',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3,
            7,
            6,
            11,
            10,
            16
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Text label on pin
      m.addLayer({
        id: 'event-pin-label',
        type: 'symbol',
        source: 'conflict-events',
        layout: {
          'text-field': ['case', ['==', ['get', 'hasVideo'], 1], '▶', '•'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 16],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-font': ['Noto Sans Bold']
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Apply persisted layer visibility toggles on initial load
      applyLayerVisibility(m, layersRef.current);

      // Persist camera position so Feed <-> Map transitions keep viewport
      m.on('moveend', () => {
        if (!map.current) return;
        const c = m.getCenter();
        setMapCenter([c.lng, c.lat]);
        setMapZoom(m.getZoom());
      });

      // Execute any fly-to requested while the map was dynamically mounting
      const queuedFlyTo = useFireStore.getState().pendingFlyTo;
      if (queuedFlyTo) {
        setPendingFlyTo(null);
        m.flyTo({
          center: [queuedFlyTo.lng, queuedFlyTo.lat],
          zoom: queuedFlyTo.zoom || 10,
          pitch: 50,
          duration: 1600
        });
      }

      // ── Fire pulse + smoke drift animation ──
      // Runs only while facility fires exist, the fires layer is visible,
      // the tab is foregrounded, and reduced motion is not requested.
      // Throttled to every 3rd frame (~20fps) to cut WebGL paint overhead.
      let animFrame = 0;
      const animateFires = () => {
        if (!map.current) return;
        animFrame++;
        if (animFrame % 3 === 0) {
          const t = animFrame * 0.03;
          const pulse = 1 + 0.15 * Math.sin(t * 2); // glow breathes
          const smokeY = -3 - 2 * Math.sin(t * 0.7); // smoke drifts up/down
          const smokeOp = 0.12 + 0.06 * Math.sin(t * 1.3); // smoke fades in/out
          try {
            m.setPaintProperty('fires-glow', 'circle-opacity', 0.25 * pulse);
            m.setPaintProperty('fires-smoke', 'circle-translate', [
              Math.sin(t * 0.5) * 2,
              smokeY
            ]);
            m.setPaintProperty('fires-smoke', 'circle-opacity', smokeOp);
          } catch {}
        }
        animFrameRef.current = requestAnimationFrame(animateFires);
      };
      const startAnim = () => {
        if (animFrameRef.current === null) {
          animFrameRef.current = requestAnimationFrame(animateFires);
        }
      };
      const stopAnim = () => {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const shouldAnimate = () =>
        layersRef.current.markers &&
        facilityStatsRef.current.size > 0 &&
        !document.hidden &&
        !motionQuery.matches;
      const syncAnim = () => {
        if (shouldAnimate()) startAnim();
        else stopAnim();
      };
      animSyncRef.current = syncAnim;
      const onMotionChange = () => syncAnim();
      const onVisibility = () => syncAnim();
      motionQuery.addEventListener('change', onMotionChange);
      document.addEventListener('visibilitychange', onVisibility);
      animCleanupRef.current = () => {
        motionQuery.removeEventListener('change', onMotionChange);
        document.removeEventListener('visibilitychange', onVisibility);
      };
      syncAnim();

      // ── Single prioritized click handler (prevents stacked popups on overlapping pins) ──
      m.on('click', (e) => {
        const hitFeatures = m.queryRenderedFeatures(e.point, {
          layers: ['event-pin-core', 'facility-core', 'fires-points']
        });
        if (hitFeatures.length === 0) return;

        // Priority: conflict event pin > curated facility > raw FIRMS fire dot
        const eventFeature = hitFeatures.find(
          (f) => f.layer.id === 'event-pin-core'
        );
        if (eventFeature && eventFeature.geometry.type === 'Point') {
          const props = eventFeature.properties;
          const coords: [number, number] = [
            eventFeature.geometry.coordinates[0],
            eventFeature.geometry.coordinates[1]
          ];

          if (popup.current) popup.current.remove();

          const html = buildEventPopupHtml(
            {
              category: props?.category || '',
              color: props?.color || '#999',
              date: props?.date,
              title: props?.title || '',
              description: props?.description || '',
              killed: props?.killed ? Number(props.killed) : 0,
              displaced: props?.displaced ? Number(props.displaced) : 0,
              videoId: props?.videoId || null,
              sourceUrl: props?.sourceUrl || ''
            },
            isMutedRef.current
          );

          popup.current = new Popup({
            closeButton: true,
            maxWidth: 'calc(100vw - 40px)',
            className: 'event-popup',
            offset: 15
          })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(m);
          attachPopupMuteHandler(popup.current);
          m.easeTo({
            center: coords,
            offset: [0, Math.min(-60, -window.innerHeight * 0.12)],
            duration: 400
          });
          if (props?.id) {
            window.dispatchEvent(
              new CustomEvent('timeline-sync', {
                detail: { eventId: props.id }
              })
            );
          }
          return;
        }

        const facilityFeature = hitFeatures.find(
          (f) => f.layer.id === 'facility-core'
        );
        if (facilityFeature && facilityFeature.geometry.type === 'Point') {
          const props = facilityFeature.properties;
          const coords: [number, number] = [
            facilityFeature.geometry.coordinates[0],
            facilityFeature.geometry.coordinates[1]
          ];
          const facility = curatedFires.find((f) => f.id === props?.id);
          if (!facility) return;

          if (popup.current) popup.current.remove();

          const effectiveStatus = getEffectiveFacilityStatus(
            facility,
            timelineDateRef.current,
            facilityStatsRef.current.get(facility.id)?.maxFRP ?? 0
          );

          const linkedEvent = eventsRef.current.find(
            (ev) =>
              ev.facilityId === facility.id &&
              ev.date <= timelineDateRef.current
          );
          const ytMedia = linkedEvent?.mediaUrls?.find(
            (media) => media.type === 'youtube'
          );
          const videoId = ytMedia ? getYouTubeId(ytMedia.url) : null;

          const html = buildFacilityPopupHtml(
            {
              name: facility.name,
              country: facility.country,
              facilityType: facility.facilityType,
              status: effectiveStatus,
              attackDate: facility.attackDate,
              capacityBPD: facility.capacityBPD,
              gasCapacityBCFD: facility.gasCapacityBCFD,
              lngMTPA: facility.lngMTPA,
              storageMBBL: facility.storageMBBL,
              percentGlobalCapacity: facility.percentGlobalCapacity,
              whyItMatters: facility.whyItMatters,
              ifDestroyed: facility.ifDestroyed,
              newsSourceUrl: facility.newsSourceUrl,
              videoId
            },
            isMutedRef.current
          );

          popup.current = new Popup({
            closeButton: true,
            maxWidth: 'calc(100vw - 40px)',
            className: 'event-popup',
            offset: 15
          })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(m);
          attachPopupMuteHandler(popup.current);
          m.easeTo({
            center: coords,
            offset: [0, Math.min(-60, -window.innerHeight * 0.12)],
            duration: 400
          });
          return;
        }

        const fireFeature = hitFeatures.find(
          (f) => f.layer.id === 'fires-points'
        );
        if (fireFeature && fireFeature.geometry.type === 'Point') {
          const coords: [number, number] = [
            fireFeature.geometry.coordinates[0],
            fireFeature.geometry.coordinates[1]
          ];
          const props = fireFeature.properties;

          if (popup.current) popup.current.remove();

          popup.current = new Popup({
            closeButton: true,
            maxWidth: '260px',
            offset: 15
          })
            .setLngLat(coords)
            .setHTML(
              buildFirePopupHtml({
                frp: props?.frp ? Number(props.frp) : 0,
                estimatedCO2TonsDay: props?.estimatedCO2TonsDay
                  ? Number(props.estimatedCO2TonsDay)
                  : 0,
                satellite: props?.satellite || '',
                acqDate: props?.acq_date || '',
                acqTime: props?.acq_time || ''
              })
            )
            .addTo(m);
        }
      });

      // Cursors
      for (const layerId of [
        'facility-core',
        'fires-points',
        'event-pin-core'
      ]) {
        m.on('mouseenter', layerId, () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', layerId, () => {
          m.getCanvas().style.cursor = '';
        });
      }
    });
  }, [setMapCenter, setMapZoom, setPendingFlyTo]);

  // Initialize map
  useEffect(() => {
    initMap();
    return () => {
      mapLoadedRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      animCleanupRef.current?.();
      animCleanupRef.current = null;
      animSyncRef.current = null;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initMap]);

  // Update fire data on map (only facility-matched fires active at timelineDate)
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('fires') as GeoJSONSource | undefined;
    if (source) {
      const facilityFires: FireGeoJSON = {
        type: 'FeatureCollection',
        features: fireData.features.filter((f) => {
          const id = f.properties.matchedFacility?.id;
          return Boolean(id && facilityStats.has(id));
        })
      };
      source.setData(facilityFires);
    }
  }, [fireData, facilityStats]);

  // Update facility status/colors when timeline date or live satellite FRP changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('facilities') as
      GeoJSONSource | undefined;
    if (source) {
      source.setData(buildFacilitiesGeoJSON(timelineDate, facilityStats));
    }
  }, [timelineDate, facilityStats]);

  // Update event pins when runtime events hydrate or timeline date changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('conflict-events') as
      GeoJSONSource | undefined;
    if (source) {
      source.setData(buildEventsGeoJSON(getEventsUpTo(events, timelineDate)));
    }
  }, [events, timelineDate]);

  // Toggle layers
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    applyLayerVisibility(map.current, layers);
  }, [layers]);

  // Execute store-driven fly-to targets once the map is loaded
  useEffect(() => {
    if (!pendingFlyTo || !map.current || !mapLoadedRef.current) return;
    const target = pendingFlyTo;
    setPendingFlyTo(null);
    map.current.flyTo({
      center: [target.lng, target.lat],
      zoom: target.zoom || 10,
      pitch: 50,
      duration: 1600
    });
  }, [pendingFlyTo, setPendingFlyTo]);

  // Listen for show-event events (auto-playback opens pin popups)
  useEffect(() => {
    const handler = (e: Event) => {
      const { eventId } = (e as CustomEvent).detail;
      if (!map.current) return;
      const m = map.current;

      // Always resolve the full event from source data for rich content
      // Vanilla store access — the handler must not capture a stale list
      const ev = useEventsStore
        .getState()
        .events.find((evt) => evt.id === eventId);
      if (!ev || !ev.lat || !ev.lng) return;

      if (popup.current) popup.current.remove();

      // Build popup HTML — same quality as click handler (matches refinery pin style)
      const ytMedia = ev.mediaUrls?.find((media) => media.type === 'youtube');
      const videoId = ytMedia ? getYouTubeId(ytMedia.url) : null;

      const html = buildEventPopupHtml(
        {
          category: ev.category,
          color: CATEGORY_COLORS[ev.category],
          date: ev.date,
          title: ev.title,
          description: ev.description,
          killed: ev.casualties?.killed || 0,
          displaced: ev.casualties?.displaced || 0,
          videoId,
          sourceUrl: ev.sourceUrl
        },
        isMutedRef.current
      );

      popup.current = new Popup({
        closeButton: true,
        maxWidth: 'calc(100vw - 40px)',
        className: 'event-popup',
        offset: 15
      })
        .setLngLat([ev.lng!, ev.lat!])
        .setHTML(html)
        .addTo(m);
      attachPopupMuteHandler(popup.current);
      m.easeTo({
        center: [ev.lng!, ev.lat!],
        offset: [0, Math.min(-60, -window.innerHeight * 0.12)],
        duration: 400
      });
    };
    window.addEventListener('map-show-event', handler);
    return () => window.removeEventListener('map-show-event', handler);
  }, []);

  return <div ref={mapContainer} className='h-full w-full' />;
}
