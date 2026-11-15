import { useSyncExternalStore } from 'react';

const MEDIA_QUERY = '(max-width: 768px)';

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useMediaQuery() {
  const isOpen = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return { isOpen };
}
