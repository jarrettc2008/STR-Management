import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function exportFile(bytes:Uint8Array,name:string,mimeType:string){
  if(!await Sharing.isAvailableAsync())throw new Error('File sharing is not available on this device.');
  const file=new File(Paths.cache,name);file.write(bytes);
  await Sharing.shareAsync(file.uri,{mimeType,dialogTitle:'Export Work Log report'});
}
