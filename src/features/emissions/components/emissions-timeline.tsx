'use client';

import { useMemo } from 'react';
import { useFireStore } from '@/stores/fire-store';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const FACILITY_COLORS: Record<string, string> = {
  refinery: '#ef4444',
  lng_terminal: '#3b82f6',
  pipeline: '#f59e0b',
  storage: '#8b5cf6',
  oil_field: '#10b981',
  gas_field: '#14b8a6',
  port: '#06b6d4',
  unknown: '#6b7280'
};

export default function EmissionsTimeline() {
  const fireData = useFireStore((s) => s.fireData);
  const loading = useFireStore((s) => s.loading);

  const { data, allTypes } = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    const typeSet = new Set<string>();

    for (const f of fireData.features) {
      const date = f.properties.acq_date;
      if (!date) continue;

      const type = f.properties.matchedFacility?.facilityType || 'unknown';
      const co2 = f.properties.estimatedCO2TonsDay || 0;

      let entry = dateMap.get(date);
      if (!entry) {
        entry = {};
        dateMap.set(date, entry);
      }
      entry[type] = (entry[type] || 0) + co2;
      typeSet.add(type);
    }

    const sortedData = Array.from(dateMap.entries())
      .map(([date, types]) => ({
        date,
        ...types
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      data: sortedData,
      allTypes: Array.from(typeSet)
    };
  }, [fireData.features]);

  if (data.length === 0) {
    return (
      <div className='text-muted-foreground flex h-64 items-center justify-center'>
        <p>
          {loading
            ? 'Loading live satellite fire data...'
            : 'No live satellite thermal detections available right now.'}
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width='100%' height={400}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray='3 3'
          stroke='var(--border)'
          opacity={0.7}
        />
        <XAxis
          dataKey='date'
          stroke='var(--muted-foreground)'
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          stroke='var(--muted-foreground)'
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))
          }
          label={{
            value: 'CO₂ (tons/day)',
            angle: -90,
            position: 'insideLeft',
            style: { fill: 'var(--muted-foreground)', fontSize: 12 }
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}
          labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
          formatter={(value) => {
            const num = typeof value === 'number' ? value : Number(value);
            return Number.isFinite(num)
              ? `${Math.round(num).toLocaleString()} t/day`
              : String(value ?? '');
          }}
        />
        <Legend />
        {allTypes.map((type) => (
          <Area
            key={type}
            type='monotone'
            dataKey={type}
            stackId='1'
            stroke={FACILITY_COLORS[type] || '#6b7280'}
            fill={FACILITY_COLORS[type] || '#6b7280'}
            fillOpacity={0.45}
            name={type.replace('_', ' ')}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
