'use client';

import { useEffect, useCallback } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { matchFacility } from '@/features/fires/data/curated-fires';
import { estimateCO2 } from '@/features/emissions/utils/emissions-model';
import type { FireFeature, FireGeoJSON } from '@/stores/fire-store';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

interface FirmsPayload extends FireGeoJSON {
  metadata?: {
    error?: string;
    fetchedAt?: string;
    fallback?: boolean;
  };
}

let inFlightFetch: Promise<void> | null = null;
let lastFetchedClientMs = 0;

function enrichFireData(data: FirmsPayload): FireGeoJSON {
  return {
    type: 'FeatureCollection',
    features: data.features.map((f: FireFeature) => {
      const facility = matchFacility(
        f.properties.latitude,
        f.properties.longitude
      );
      const co2 = estimateCO2(f.properties.frp, facility?.facilityType || null);

      return {
        ...f,
        properties: {
          ...f.properties,
          estimatedCO2TonsDay: co2,
          matchedFacility: facility
            ? {
                id: facility.id,
                name: facility.name,
                facilityType: facility.facilityType,
                capacityBPD: facility.capacityBPD,
                country: facility.country,
                status: facility.status,
                newsSourceUrl: facility.newsSourceUrl,
                description: facility.description,
                percentGlobalCapacity: facility.percentGlobalCapacity
              }
            : null
        }
      };
    })
  };
}

export function fetchFiresOnce(force = false): Promise<void> {
  const store = useFireStore.getState();
  const isFresh =
    !force &&
    lastFetchedClientMs > 0 &&
    Date.now() - lastFetchedClientMs < REFRESH_INTERVAL &&
    store.fireData.features.length > 0;

  if (isFresh) return Promise.resolve();
  if (inFlightFetch) return inFlightFetch;

  store.setLoading(true);
  store.setError(null);

  inFlightFetch = (async () => {
    try {
      let data: FirmsPayload | null = null;
      let source: 'live' | 'snapshot' = 'snapshot';

      try {
        const res = await fetch('/api/firms?days=2&source=VIIRS_SNPP_NRT');
        if (res.ok) {
          const apiData = (await res.json()) as FirmsPayload;
          if (Array.isArray(apiData?.features) && apiData.features.length > 0) {
            data = apiData;
            source = 'live';
          }
        }
      } catch {
        // Ignore and try static snapshot fallback below
      }

      if (!data) {
        const fallbackRes = await fetch('/firms-latest.json');
        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
        data = (await fallbackRes.json()) as FirmsPayload;
        source = data.metadata?.fallback ? 'snapshot' : 'live';
      }

      if (!data || !Array.isArray(data.features)) {
        throw new Error('Invalid fire data response');
      }

      const enriched = enrichFireData(data);
      const parsedFetchedAt = data.metadata?.fetchedAt
        ? new Date(data.metadata.fetchedAt)
        : null;
      const updatedDate =
        parsedFetchedAt && !Number.isNaN(parsedFetchedAt.getTime())
          ? parsedFetchedAt
          : new Date();

      const latest = useFireStore.getState();
      latest.setFireData(enriched, source);
      latest.setLastUpdated(updatedDate);
      lastFetchedClientMs = Date.now();
    } catch (err) {
      useFireStore
        .getState()
        .setError(
          err instanceof Error ? err.message : 'Failed to fetch fire data'
        );
    } finally {
      useFireStore.getState().setLoading(false);
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export function useFireData() {
  const refetch = useCallback(() => fetchFiresOnce(true), []);

  useEffect(() => {
    void fetchFiresOnce(false);
    const interval = setInterval(() => {
      void fetchFiresOnce(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return { refetch };
}
