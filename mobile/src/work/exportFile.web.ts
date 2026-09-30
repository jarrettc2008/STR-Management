export async function exportFile(bytes:Uint8Array,name:string,mimeType:string){
  const copy=new Uint8Array(bytes.length);copy.set(bytes);
  const url=URL.createObjectURL(new Blob([copy.buffer],{type:mimeType}));const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
