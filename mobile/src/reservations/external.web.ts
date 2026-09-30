import { safeExternalUrl } from './domain';
export async function openExternal(url:string){window.open(safeExternalUrl(url),'_blank','noopener,noreferrer');}
