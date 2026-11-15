#!/usr/bin/env python3
"""Create aligned PNGs from already georeferenced HLS red/green/blue stacks and binary QA masks.
Input stack order is RGB, not provider band order. QA=1 valid; upstream decode must be source-specific.
"""
import argparse,json,pathlib
import numpy as np
import rasterio
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--scene',action='append',required=True,help='date,rgb_stack.tif,valid_qa.tif; repeat per scene');p.add_argument('--metadata',required=True);p.add_argument('--site',required=True);p.add_argument('--output-dir',required=True);p.add_argument('--reflectance-scale',type=float,default=.0001);p.add_argument('--offset',type=float,default=0);p.add_argument('--stretch-max',type=float,default=.3);a=p.parse_args()
out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True);meta=json.loads(pathlib.Path(a.metadata).read_text());frames=[];sig=None
for specification in a.scene:
 date,stack,qa=specification.split(',')
 with rasterio.open(stack) as r,rasterio.open(qa) as q:
  current=(r.width,r.height,r.transform,r.crs);assert sig is None or current==sig,'All scenes must share bounds, pixel alignment, CRS and dimensions';sig=current
  assert (q.width,q.height,q.transform,q.crs)==current,'QA footprint mismatch';assert r.count>=3
  bands=r.read([1,2,3],masked=True);mask=(q.read(1,masked=True)==1).filled(False)&~np.any(np.ma.getmaskarray(bands),axis=0)
  reflectance=bands.filled(0)*a.reflectance_scale+a.offset;rgb=np.moveaxis(np.uint8(np.clip(reflectance/a.stretch_max,0,1)*255),0,-1);rgba=np.dstack([rgb,np.uint8(mask)*255]);name=f'{a.site}-{date}.png';Image.fromarray(rgba).save(out/name)
  frames.append(dict(date=date,asset=(out.name+'/'+name),status='valid' if mask.mean()>=.5 else 'cloud-masked',validPercent=round(float(mask.mean()*100),2)))
meta['qa']=meta.get('qa','')+f'; RGB scale {a.reflectance_scale}; offset {a.offset}; fixed stretch 0–{a.stretch_max}; invalid pixels transparent'
payload={'mode':'real','version':'1.0.0','locationId':a.site,'meta':{'imagery':meta},'imagery':frames};(out/f'{a.site}-imagery.json').write_text(json.dumps(payload,indent=2));print('Prepared',len(frames),'aligned scenes. Assets assume this output directory is directly below public/data; adjust relative paths if nested deeper.')
