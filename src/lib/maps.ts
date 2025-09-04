import { openMap } from '@/utils/platform';

export function openMaps(address: string, eventName?: string) {
  openMap(address, eventName);
}