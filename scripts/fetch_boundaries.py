#!/usr/bin/env python3
"""Optional official display-geometry refresh to a staging directory; never silently replace runtime."""
import argparse,datetime,json,pathlib,urllib.request,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--output-dir',default='staging/boundaries');a=p.parse_args();out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True);log=[]
base='https://services8.arcgis.com/5xxEi7I2m6ml97fE/arcgis/rest/services/'
for name,service in [('basin','boundary_gdb'),('regions','North_southern_basin_gdb'),('catchments','BASIN_PLAN_REGIONS')]:
 u=base+service+'/FeatureServer/0/query?'+urllib.parse.urlencode({'where':'1=1','outFields':'*','returnGeometry':'true','outSR':4326,'geometryPrecision':5,'maxAllowableOffset':.005,'f':'geojson'})
 d=json.load(urllib.request.urlopen(u,timeout=45));assert d.get('type')=='FeatureCollection' and d['features'];(out/(name+'0.geojson')).write_text(json.dumps(d,separators=(',',':')));log.append({'path':name+'0.geojson','url':u,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
(out/'acquisition-log.json').write_text(json.dumps(log,indent=2));print('Staged official geometry:',out)
