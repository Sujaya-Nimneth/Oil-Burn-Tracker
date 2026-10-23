'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { matchFacility } from '@/features/fires/data/curated-fires';
import { estimateCO2 } from '@/features/emissions/utils/emissions-model';
import type { FireFeature, FireGeoJSON } from '@/stores/fire-store';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useFireData() {
  const setFireData = useFireStore((s) => s.setFireData);
  const setLoading = useFireStore((s) => s.setLoading);
  const setError = useFireStore((s) => s.setError);
  const setLastUpdated = useFireStore((s) => s.setLastUpdated);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFires = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let data:
        | (FireGeoJSON & { metadata?: { error?: string; fetchedAt?: string } })
        | null = null;

      try {
        const res = await fetch('/api/firms?days=2&source=VIIRS_SNPP_NRT');
        if (res.ok) {
          const apiData = await res.json();
          if (Array.isArray(apiData?.features) && apiData.features.length > 0) {
            data = apiData;
          }
        }
      } catch {
        // Ignore and try static snapshot fallback below
      }

      if (!data) {
        const fallbackRes = await fetch('/firms-latest.json');
        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
        data = await fallbackRes.json();
      }

      if (!data || !Array.isArray(data.features)) {
        throw new Error('Invalid fire data response');
      }

      // Enrich with facility matching and CO2 recalculation
      const enriched: FireGeoJSON = {
        type: 'FeatureCollection',
        features: data.features.map((f: FireFeature) => {
          const facility = matchFacility(
            f.properties.latitude,
            f.properties.longitude
          );
          const co2 = estimateCO2(
            f.properties.frp,
            facility?.facilityType || null
          );

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

      setFireData(enriched);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch fire data'
      );
    } finally {
      setLoading(false);
    }
  }, [setFireData, setLoading, setError, setLastUpdated]);

  useEffect(() => {
    fetchFires();
    intervalRef.current = setInterval(fetchFires, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFires]);

  return { refetch: fetchFires };
}
