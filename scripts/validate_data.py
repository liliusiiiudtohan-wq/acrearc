#!/usr/bin/env python3
"""Validate the shipped runtime contract without network or third-party Python packages."""
import sys,json,pathlib,math,hashlib,datetime
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'public/data').resolve()
def load(path):
 p=(root/path).resolve();assert p.is_relative_to(root),f'Path escapes data root: {path}'
 return json.loads(p.read_text())
def number(value,lo,hi):assert value is None or isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and lo<=value<=hi,f'Invalid value {value}'
def series(rows,keys,ranges):
 seen=set()
 for row in rows:
  d=row['date'];assert datetime.date.fromisoformat(d).isoformat()==d
  assert d not in seen,f'Duplicate date {d}';seen.add(d)
  assert row['status'] in ['valid','missing','masked','out-of-coverage','failed']
  if row['status'] in ['masked','out-of-coverage','failed']:assert all(row[k] is None for k in keys),'Unavailable QA values must be null'
  for key,(lo,hi) in zip(keys,ranges):number(row[key],lo,hi)
m=load('manifest.json');assert m['contractVersion']=='field-shift-data/1.0.0'
for field in ['basin','regions','catchments','lgas','context']:
 g=load(m['boundaries'][field]);assert g['type']=='FeatureCollection' and g['features'];assert all(x['geometry']['type'] in ['Polygon','MultiPolygon'] for x in g['features'])
source_ids={s['id'] for s in m['sources']};assert len(source_ids)==len(m['sources'])
for s in m['sources']:
 for field in ['id','name','product','version','mode','units','resolution','support','start','end','retrievedAt','processedAt','query','license','qa','timeStandard','status']:assert field in s,(s['id'],field)
 assert s['mode'] in ['real','example']
for s in m['sites']:
 number(s['lat'],-90,90);number(s['lon'],-180,180)
 if s.get('powerFile'):
  p=load(s['powerFile']);assert p['geometry']['coordinates'][:2]==[s['lon'],s['lat']]
  assert p['header']['time_standard']=='LST';fill=p['header']['fill_value'];assert isinstance(fill,(int,float))
  for k,unit in [('PRECTOTCORR','mm/day'),('T2M_MAX','C'),('T2M_MIN','C'),('T2M','C'),('TS','C')]:
   assert p['parameters'][k]['units']==unit
   assert len(p['properties']['parameter'][k])==3653
  print(s['id'],'POWER: 3653 days, coordinates / LST / units / fill checked')
 x=load('example/'+s['id']+'.json');assert x['mode']=='example' and x['locationId']==s['id']
 series(x['days'],['rain','max','min','mean','skin'],[(0,2000),(-90,65),(-100,60),(-100,65),(-100,90)])
 series(x['moisture'],['surface','root'],[(0,1),(0,1)]);series(x['ndvi'],['value'],[(-1,1)])
 for c in x['grid']:number(c['surface'],0,1);number(c['root'],0,1)
 for f in x['flood']:
  assert f['ref'] in ['land','water','masked'] and f['event'] in ['land','water','masked'];number(f['areaKm2'],0,1000000)
 for f in x['imagery']:
  if f['asset']:assert (root/f['asset']).is_file()
for l in m['layers']:
 assert l['sourceId'] in source_ids;assert next(s for s in m['sources'] if s['id']==l['sourceId'])['mode']==l['mode']
 x=load(l['asset']);assert x['mode']==l['mode'] and x['locationId']==l['siteId']
 if l['mode']=='real':
  assert 'meta' in x, 'Real layer needs source-specific metadata'
  for key,keys,ranges in [('imerg',['rain'],[(0,2000)]),('late',['rain'],[(0,2000)]),('moisture',['surface','root'],[(0,1),(0,1)]),('ndvi',['value'],[(-1,1)])]:
   if key in x:series(x[key],keys,ranges)
checks=load('checksums.json')
for file,sha in checks.items():assert hashlib.sha256((root/file).read_bytes()).hexdigest()==sha,f'Checksum changed: {file}. Regenerate checksums after intentional pack changes.'
print('PASS:',len(m['sites']),'sites;',len(m['sources']),'sources;',len(m['layers']),'layers;',len(checks),'asset checksums')
