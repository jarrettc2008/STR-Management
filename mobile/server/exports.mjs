import { hours, exactTime } from '../src/work/domain.ts';
export function reportLines(report) {
  const name = id => report.properties.find(p => p.id === id)?.name || id;
  return ['WORK LOG REPORT', `Tax year: ${report.filters.year}`, `Property: ${report.filters.propertyId ? name(report.filters.propertyId) : 'All properties'}`, `Work type: ${report.filters.workType || 'All types'}`, `TOTAL: ${hours(report.totalMinutes)} hours | ${exactTime(report.totalMinutes)} | ${report.totalMinutes} minutes`, 'Hours are rounded for display; integer minutes are the accounting source of truth.', '', 'HOURS BY WORK TYPE', ...Object.entries(report.byType).map(([key, m]) => `${key}: ${hours(m)} hours (${m} minutes)`), '', 'HOURS BY PROPERTY', ...Object.entries(report.byProperty).map(([key, m]) => `${name(key)}: ${hours(m)} hours (${m} minutes)`), '', 'MONTHLY BREAKDOWN', ...report.monthly.map(({month,minutes}) => `${new Date(2000, Number(month)-1, 1).toLocaleDateString('en-US',{month:'long'})}: ${hours(minutes)} hours (${minutes} minutes)`), '', 'DETAILED WORK LOG', ...report.rows.flatMap(e => [`${e.workDate} | ${name(e.propertyId)} | ${e.workType}`, `${e.startTime || '-'} - ${e.endTime || '-'} | ${hours(e.minutesWorked)} hours | ${e.minutesWorked} minutes`, e.description, ''])];
}
export function csvReport(report) {
  const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
  const rows = reportLines({...report,rows:[]}).map(line => [line]);
  rows.push(['Date','Property','Work Type','Start','End','Hours','Minutes','Description']);
  for (const e of report.rows) rows.push([e.workDate,report.properties.find(p=>p.id===e.propertyId)?.name || e.propertyId,e.workType,e.startTime,e.endTime,hours(e.minutesWorked),e.minutesWorked,e.description]);
  return '\uFEFF' + rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
// Small dependency-free text PDF: paginated accountant report, not a new export framework.
export function pdfReport(report) {
  const lines = reportLines(report).flatMap(line => {
    const result = []; let remaining = line.replace(/[\r\n\t]/g, ' ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\u00a0/g,' ');
    if (/[^\x20-\x7e]/.test(remaining)) throw new Error('This PDF format supports English text. Export CSV to preserve non-English characters.');
    while (remaining.length > 84) { let split = remaining.lastIndexOf(' ',84); if (split < 20) split=84; result.push(remaining.slice(0,split)); remaining=remaining.slice(split).trimStart(); }
    result.push(remaining); return result;
  });
  const pages = []; for (let i=0;i<lines.length;i+=46) pages.push(lines.slice(i,i+46));
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];
  const kids = [];
  const escape = s => s.replace(/([\\()])/g,'\\$1');
  pages.forEach((page,i) => {
    const pageId=objects.length+1, streamId=pageId+1; kids.push(`${pageId} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    const stream=`BT /F1 10 Tf 48 750 Td 15 TL ${page.map((line,j)=>`${j?'T* ':''}(${escape(line)}) Tj`).join('\n')} ET\nBT /F1 9 Tf 48 28 Td (Staywell | Work Log | Page ${i+1} of ${pages.length}) Tj ET`;
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects[0]='<< /Type /Catalog /Pages 2 0 R >>'; objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let pdf='%PDF-1.4\n'; const offsets=[0]; objects.forEach((obj,i)=>{ offsets.push(Buffer.byteLength(pdf)); pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
