import * as Linking from 'expo-linking';
import { safeExternalUrl } from './domain';
export async function openExternal(url:string){await Linking.openURL(safeExternalUrl(url));}
