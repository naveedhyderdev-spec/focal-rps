// Standalone verification of the workbook parser logic against the real file.
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const FILE = 'C:/PROJECTS/Resource_Management_Vinod/Shared_Files_Vinod/Focal Resource Forecast - LIVE_v2 1.xlsx';

const toISO = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const serialToISO = (s) => toISO(new Date(Date.UTC(1899,11,30) + s*86400000));
const cellDate = (v) => v instanceof Date ? toISO(v) : (typeof v==='number' && v>40000 && v<60000 ? serialToISO(v) : null);
const str = (v) => v==null ? '' : String(v).trim();

const wb = XLSX.read(readFileSync(FILE), { cellDates: true });

// Staff Names
const resources = [];
const staff = wb.Sheets['Staff Names'];
const srows = XLSX.utils.sheet_to_json(staff, { header: 1, blankrows: false });
for (let i=1;i<srows.length;i++){ const r=srows[i]; const fn=str(r[1]); const fore=str(r[4]); if(!fore) continue; resources.push({full_name:fn||fore, forename:fore, disc:str(r[2])||null, grade:str(r[3])||null, team:str(r[5])||null, loc:str(r[6])||null}); }

// Project Resource
const projects=[], stages=[], allocations=[]; const weekSet=new Set();
const pr = wb.Sheets['Project Resource'];
const rows = XLSX.utils.sheet_to_json(pr, { header:1, blankrows:false });
let weekCols=[], currentProject=null, mode=null; const seen=new Set();
for (const r of rows){
  const a=str(r[0]);
  if (a.toUpperCase()==='PROJECT'){ weekCols=[]; for(let c=5;c<r.length;c++){ const iso=cellDate(r[c]); if(iso){weekCols.push({col:c,date:iso}); weekSet.add(iso);} } continue; }
  if (a.toLowerCase()==='resource'){ mode='resources'; continue; }
  const stage=str(r[1]); const s=cellDate(r[2]); const e=cellDate(r[3]);
  if (a && stage && s){ currentProject=a; if(!seen.has(a)){seen.add(a); projects.push(a);} mode='stages'; if(e) stages.push({p:a,stage,s,e}); continue; }
  if (mode==='stages' && !a && stage && s && e && currentProject){ stages.push({p:currentProject,stage,s,e}); continue; }
  if (mode==='resources' && a && currentProject){ for(const wc of weekCols){ const v=r[wc.col]; if(typeof v==='number'&&v>0) allocations.push({res:a,proj:currentProject,week:wc.date,factor:v}); } }
}

const weeks=[...weekSet].sort();
console.log('SHEETS:', wb.SheetNames.join(', '));
console.log('RESOURCES:', resources.length);
console.log('  sample:', resources.slice(0,3).map(r=>`${r.forename} [${r.disc}/${r.grade}/${r.team}/${r.loc}]`));
console.log('PROJECTS:', projects.length);
console.log('  sample:', projects.slice(0,6));
console.log('STAGES:', stages.length, '· sample:', stages.slice(0,3));
console.log('ALLOCATIONS:', allocations.length);
console.log('  sample:', allocations.slice(0,4));
console.log('WEEKS:', weeks.length, weeks[0], '→', weeks[weeks.length-1]);
const factors=[...new Set(allocations.map(a=>a.factor))].sort((x,y)=>x-y);
console.log('DISTINCT FACTORS:', factors.slice(0,12));
