import type { Guest } from './domain.ts';
export function profileLink(guest: Guest, demo: boolean) {
  if (demo) return { url: 'https://www.facebook.com/', label: 'Open demo Facebook link (homepage, not a guest profile)' };
  if (guest.profileVerifiedManually && guest.profileUrl) return { url: guest.profileUrl, label: 'Open verified guest profile' };
  return null;
}
