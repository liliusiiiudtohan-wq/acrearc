#!/usr/bin/env python3
"""Prepare small, already aligned/equal-area sensor-QA water clips. Optional rasterio dependency.
QA inputs must be upstream binary masks (1 valid, 0 invalid) derived from the exact sensor product.
"""
import argparse,json,pathlib
import numpy as np
import rasterio
from rasterio.warp import transform as transform_coords
p=argparse.ArgumentParser();p.add_argument('--reference',required=True);p.add_argument('--event',required=True);p.add_argument('--reference-qa',required=True);p.add_argument('--event-qa',required=True);p.add_argument('--permanent',required=True);p.add_argument('--classes',required=True,help='JSON with land and water raw class lists; all others masked');p.add_argument('--metadata',required=True);p.add_argument('--site',required=True);p.add_argument('--output',required=True);p.add_argument('--max-cells',type=int,default=10000);a=p.parse_args()
paths=[a.reference,a.event,a.reference_qa,a.event_qa,a.permanent];arrays=[];sig=None
for path in paths:
 with rasterio.open(path) as r:
  assert r.crs and r.crs.to_epsg()==3577,'Reproject all inputs to GDA94 / Australian Albers EPSG:3577 first'
  current=(r.width,r.height,r.transform,r.crs);assert sig is None or current==sig,'All rasters must share pixel alignment / shape / CRS';sig=current
  assert r.width*r.height<=a.max_cells,'Subset a smaller AOI for the browser prototype'
  arrays.append(r.read(1,masked=True));transform=r.transform;crs=r.crs
classes=json.loads(pathlib.Path(a.classes).read_text());assert set(classes['land']).isdisjoint(classes['water']);meta=json.loads(pathlib.Path(a.metadata).read_text());assert all(k in meta for k in ['source','resolution','start','end','qa'])
ref,event,rqa,eqa,permanent=arrays;pixels=[];area=abs(transform.a*transform.e-transform.b*transform.d)/1e6
for row in range(sig[1]):
 for col in range(sig[0]):
  def category(arr,qa):
   if np.ma.is_masked(arr[row,col]) or np.ma.is_masked(qa[row,col]) or qa[row,col]!=1:return 'masked'
   n=float(arr[row,col]);return 'water' if n in classes['water'] else 'land' if n in classes['land'] else 'masked'
  x1,y1=transform*(col,row);x2,y2=transform*(col+1,row+1);xs,ys=transform_coords(crs,'EPSG:4326',[x1,x2],[y1,y2])
  perm=not np.ma.is_masked(permanent[row,col]) and permanent[row,col]==1
  pixels.append(dict(id=len(pixels),ref=category(ref,rqa),event=category(event,eqa),permanent=bool(perm),areaKm2=area,bounds=[min(xs),min(ys),max(xs),max(ys)]))
out={'mode':'real','version':'1.0.0','locationId':a.site,'meta':{'flood':meta},'flood':pixels};pathlib.Path(a.output).write_text(json.dumps(out,separators=(',',':')));print('Prepared',len(pixels),'cells; equal-area',area,'km2 per pixel. Retain original CRS, source classes and QA derivation in manifest.')
