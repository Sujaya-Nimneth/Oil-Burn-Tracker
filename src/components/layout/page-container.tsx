import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PageContainer({
  children,
  scrollable = true
}: {
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return scrollable ? (
    <ScrollArea className='min-h-0 flex-1'>
      <div className='flex flex-1 flex-col p-4 md:px-6'>{children}</div>
    </ScrollArea>
  ) : (
    <div className='flex min-h-0 flex-1 flex-col p-4 md:px-6'>{children}</div>
  );
}
