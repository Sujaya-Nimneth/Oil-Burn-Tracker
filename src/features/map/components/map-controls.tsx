'use client';

import { useState } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  IconMap,
  IconFlame,
  IconBuildingFactory,
  IconSettings,
  IconX
} from '@tabler/icons-react';

interface MapControlsProps {
  onFlyTo?: (lat: number, lng: number, zoom: number) => void;
}

const REGIONS = [
  { label: 'Gulf', lat: 27.0, lng: 50.5, zoom: 7 },
  { label: 'Red Sea', lat: 20.0, lng: 39.0, zoom: 6 },
  { label: 'Hormuz', lat: 26.5, lng: 56.3, zoom: 8 },
  { label: 'Levant', lat: 33.0, lng: 36.0, zoom: 7 }
];

export default function MapControls({ onFlyTo }: MapControlsProps) {
  const layers = useFireStore((s) => s.layers);
  const toggleLayer = useFireStore((s) => s.toggleLayer);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className='absolute top-3 left-3 z-10'>
        <Button
          size='icon'
          variant='outline'
          className='bg-background/80 h-9 w-9 shadow-lg backdrop-blur-md'
          onClick={() => setOpen(true)}
        >
          <IconSettings className='h-4 w-4' />
        </Button>
      </div>
    );
  }

  return (
    <div className='absolute top-3 left-3 z-10'>
      <div className='bg-background/90 min-w-[160px] rounded-lg border p-3 shadow-lg backdrop-blur-md'>
        <div className='mb-2 flex items-center justify-between'>
          <p className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
            Layers
          </p>
          <button
            onClick={() => setOpen(false)}
            className='text-muted-foreground hover:text-foreground'
          >
            <IconX className='h-3.5 w-3.5' />
          </button>
        </div>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <Switch
              id='layer-heat'
              checked={layers.heatmap}
              onCheckedChange={() => toggleLayer('heatmap')}
            />
            <Label
              htmlFor='layer-heat'
              className='flex cursor-pointer items-center gap-1.5 text-xs'
            >
              <IconMap className='h-3 w-3' /> Heatmap
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              id='layer-points'
              checked={layers.markers}
              onCheckedChange={() => toggleLayer('markers')}
            />
            <Label
              htmlFor='layer-points'
              className='flex cursor-pointer items-center gap-1.5 text-xs'
            >
              <IconFlame className='h-3 w-3' /> Fires
            </Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              id='layer-facilities'
              checked={layers.facilities}
              onCheckedChange={() => toggleLayer('facilities')}
            />
            <Label
              htmlFor='layer-facilities'
              className='flex cursor-pointer items-center gap-1.5 text-xs'
            >
              <IconBuildingFactory className='h-3 w-3' /> Facilities
            </Label>
          </div>
        </div>
        <div className='mt-2 border-t pt-2'>
          <p className='text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase'>
            Zoom
          </p>
          <div className='flex flex-wrap gap-1'>
            {REGIONS.map((r) => (
              <Button
                key={r.label}
                size='sm'
                variant='outline'
                className='h-6 px-2 text-xs'
                onClick={() => {
                  onFlyTo?.(r.lat, r.lng, r.zoom);
                  setOpen(false);
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
