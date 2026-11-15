#!/usr/bin/env python3
"""Convert preprocessed CSV to one real, manifest-ready supplemental JSON.
Raw authenticated downloads, raster reprojection, QA and reductions occur upstream.
"""
import argparse,csv,datetime,json,pathlib,math
p=argparse.ArgumentParser();p.add_argument('kind',choices=['imerg','late','moisture','ndvi','et']);p.add_argument('csv');p.add_argument('output');p.add_argument('--site',required=True);p.add_argument('--metadata',required=True,help='JSON with source, resolution, start, end, qa, timeStandard');a=p.parse_args()
meta=json.loads(pathlib.Path(a.metadata).read_text())
for k in ['source','resolution','start','end','qa','timeStandard']:assert meta.get(k),f'Missing metadata {k}'
keys={'imerg':['rain'],'late':['rain'],'moisture':['surface','root'],'ndvi':['value'],'et':['actualET','referenceET','esi']}[a.kind]
rows=[];seen=set()
with open(a.csv,newline='') as f:
 for raw in csv.DictReader(f):
  d=raw['date'];assert datetime.date.fromisoformat(d).isoformat()==d and d not in seen,'Invalid or duplicate date';seen.add(d)
  r={'date':d,'status':raw.get('status','valid')};assert r['status'] in ['valid','missing','masked','out-of-coverage','failed']
  for k in keys:
   value=raw.get(k,'').strip();v=None if value.lower() in ['', 'null', 'na'] else float(value)
   assert v is None or math.isfinite(v),f'Nonfinite {k} at {d}'
   if v is not None:
    lo,hi=(0,1) if k in ['surface','root','esi'] else (-1,1) if k=='value' else (0,2000)
    assert lo<=v<=hi,f'Out of range {k}: {v}; filter provider fill and apply units / scaling before ingest'
   r[k]=v
  if r['status'] in ['masked','out-of-coverage','failed']:assert all(r[k] is None for k in keys),'Unavailable QA values must be null'
  if a.kind in ['imerg','late']:
   for k in ['max','min','mean','skin']:r[k]=None
  rows.append(r)
rows.sort(key=lambda r:r['date']);output={'mode':'real','version':'1.0.0','locationId':a.site,'meta':{a.kind:meta},a.kind:rows}
pathlib.Path(a.output).write_text(json.dumps(output,indent=2));print('Wrote',a.output,len(rows),'records. Register asset + ready real source/layer in manifest and validate.')
