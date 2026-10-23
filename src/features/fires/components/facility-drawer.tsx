'use client';

import { useFireStore } from '@/stores/fire-store';
import {
  getCurrentDisruptionLevel,
  type FacilityStatus,
  type ThreatLevel
} from '@/features/fires/data/curated-fires';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconFlame,
  IconAlertTriangle,
  IconEye,
  IconCircleOff,
  IconCircleCheck,
  IconExternalLink,
  IconDroplet,
  IconWorld,
  IconCalendar,
  IconMapPin,
  IconBolt,
  IconSkull,
  IconShieldCheck,
  IconGasStation
} from '@tabler/icons-react';

const STATUS_CONFIG: Record<
  FacilityStatus,
  {
    label: string;
    variant: 'destructive' | 'default' | 'secondary' | 'outline';
    icon: React.ComponentType<any>;
  }
> = {
  active_fire: {
    label: 'Active Fire',
    variant: 'destructive',
    icon: IconFlame
  },
  damaged: { label: 'Damaged', variant: 'default', icon: IconAlertTriangle },
  monitoring: { label: 'Monitoring', variant: 'secondary', icon: IconEye },
  offline: { label: 'Offline', variant: 'outline', icon: IconCircleOff },
  operational: {
    label: 'Operational',
    variant: 'outline',
    icon: IconCircleCheck
  }
};

const THREAT_CONFIG: Record<ThreatLevel, { color: string; label: string }> = {
  critical: { color: 'text-red-500', label: 'CRITICAL' },
  high: { color: 'text-orange-500', label: 'HIGH' },
  elevated: { color: 'text-yellow-500', label: 'ELEVATED' },
  moderate: { color: 'text-blue-400', label: 'MODERATE' },
  low: { color: 'text-green-500', label: 'LOW' }
};

const TYPE_LABELS: Record<string, string> = {
  refinery: 'Refinery',
  lng_terminal: 'LNG Terminal',
  pipeline: 'Pipeline',
  storage: 'Oil Storage',
  oil_field: 'Oil Field',
  gas_field: 'Gas Field',
  port: 'Port / Chokepoint'
};

function formatCapacity(f: {
  capacityBPD: number;
  gasCapacityBCFD?: number;
  lngMTPA?: number;
  storageMBBL?: number;
}) {
  const parts: string[] = [];
  if (f.capacityBPD > 0)
    parts.push(`${(f.capacityBPD / 1000000).toFixed(1)}M BPD`);
  if (f.gasCapacityBCFD) parts.push(`${f.gasCapacityBCFD} BCF/day gas`);
  if (f.lngMTPA) parts.push(`${f.lngMTPA}M tons/yr LNG`);
  if (f.storageMBBL) parts.push(`${f.storageMBBL}M bbl storage`);
  return parts;
}

export default function FacilityDrawer() {
  const selectedFacility = useFireStore((s) => s.selectedFacility);
  const setSelectedFacility = useFireStore((s) => s.setSelectedFacility);

  if (!selectedFacility) return null;

  const config = STATUS_CONFIG[selectedFacility.status];
  const StatusIcon = config.icon;
  const threat = THREAT_CONFIG[selectedFacility.threatLevel];
  const capacityParts = formatCapacity(selectedFacility);
  const disruption = getCurrentDisruptionLevel();

  return (
    <Drawer
      open={!!selectedFacility}
      onOpenChange={(open) => {
        if (!open) setSelectedFacility(null);
      }}
    >
      <DrawerContent className='max-h-[80vh]'>
        <DrawerHeader className='pb-2'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0 flex-1'>
              <DrawerTitle className='text-lg leading-tight'>
                {selectedFacility.name}
              </DrawerTitle>
              <DrawerDescription className='mt-1 flex items-center gap-1.5'>
                <IconMapPin className='h-3.5 w-3.5 shrink-0' />
                {selectedFacility.country} &middot;{' '}
                {TYPE_LABELS[selectedFacility.facilityType] ||
                  selectedFacility.facilityType}
              </DrawerDescription>
            </div>
            <div className='flex shrink-0 flex-col items-end gap-1'>
              <Badge variant={config.variant}>
                <StatusIcon className='mr-1 h-3.5 w-3.5' />
                {config.label}
              </Badge>
              <span className={`text-xs font-bold ${threat.color}`}>
                {threat.label} THREAT
              </span>
            </div>
          </div>
        </DrawerHeader>

        <ScrollArea className='flex-1 overflow-auto'>
          <div className='space-y-4 px-4 pb-6'>
            {/* Energy capacity */}
            {capacityParts.length > 0 && (
              <div className='rounded-lg border border-orange-500/30 bg-orange-500/5 p-3'>
                <div className='mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-400'>
                  <IconGasStation className='h-3.5 w-3.5' />
                  ENERGY CAPACITY
                </div>
                <div className='flex flex-wrap gap-2'>
                  {capacityParts.map((p) => (
                    <span
                      key={p}
                      className='bg-background/60 rounded px-2 py-1 font-mono text-sm font-semibold'
                    >
                      {p}
                    </span>
                  ))}
                </div>
                {selectedFacility.percentGlobalCapacity > 0 && (
                  <p className='text-muted-foreground mt-2 text-xs'>
                    ={' '}
                    <span className='text-foreground font-semibold'>
                      {selectedFacility.percentGlobalCapacity}%
                    </span>{' '}
                    of global energy capacity
                  </p>
                )}
              </div>
            )}

            {/* Why it matters */}
            <div className='bg-muted/50 rounded-lg p-3'>
              <div className='text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold'>
                <IconBolt className='h-3.5 w-3.5' />
                WHY IT MATTERS
              </div>
              <p className='text-sm leading-relaxed'>
                {selectedFacility.whyItMatters}
              </p>
            </div>

            {/* If destroyed */}
            <div className='rounded-lg border border-red-500/30 bg-red-500/5 p-3'>
              <div className='mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-400'>
                <IconSkull className='h-3.5 w-3.5' />
                IF DESTROYED
              </div>
              <p className='text-sm leading-relaxed'>
                {selectedFacility.ifDestroyed}
              </p>
            </div>

            {/* Supply chain role */}
            {selectedFacility.supplyChainRole && (
              <div className='bg-muted/50 rounded-lg p-3'>
                <div className='text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold'>
                  <IconShieldCheck className='h-3.5 w-3.5' />
                  SUPPLY CHAIN
                </div>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {selectedFacility.supplyChainRole}
                </p>
              </div>
            )}

            {/* Key details grid */}
            <div className='grid grid-cols-2 gap-3'>
              {selectedFacility.attackDate && (
                <div className='bg-muted/50 rounded-lg p-3'>
                  <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
                    <IconCalendar className='h-3.5 w-3.5' />
                    Attack Date
                  </div>
                  <p className='text-sm font-semibold'>
                    {new Date(
                      selectedFacility.attackDate + 'T00:00:00'
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}
              <div className='bg-muted/50 rounded-lg p-3'>
                <div className='text-muted-foreground mb-1 flex items-center gap-1.5 text-xs'>
                  <IconMapPin className='h-3.5 w-3.5' />
                  Coordinates
                </div>
                <p className='font-mono text-sm'>
                  {selectedFacility.lat.toFixed(4)},{' '}
                  {selectedFacility.lng.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className='text-muted-foreground text-xs leading-relaxed'>
              {selectedFacility.description}
            </p>

            {/* News source link */}
            {selectedFacility.newsSourceUrl && (
              <a
                href={selectedFacility.newsSourceUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:bg-accent flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors'
              >
                <IconExternalLink className='h-4 w-4 shrink-0' />
                <span className='truncate'>View News Source</span>
              </a>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
