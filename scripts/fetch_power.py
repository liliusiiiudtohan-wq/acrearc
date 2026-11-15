#!/usr/bin/env python3
"""Optional keyless POWER snapshot. Requests are bounded and output is separate from last-good cache."""
import argparse,datetime,json,pathlib,urllib.request,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--lat',type=float,required=True);p.add_argument('--lon',type=float,required=True);p.add_argument('--start',required=True);p.add_argument('--end',required=True);p.add_argument('--output',required=True);a=p.parse_args();start=datetime.date.fromisoformat(a.start);end=datetime.date.fromisoformat(a.end)
assert 0<=(end-start).days<=3660,'Request must be <=3661 days';assert -90<=a.lat<=90 and -180<=a.lon<=180
u='https://power.larc.nasa.gov/api/temporal/daily/point?'+urllib.parse.urlencode(dict(parameters='T2M_MAX,T2M_MIN,T2M,PRECTOTCORR,TS',community='AG',latitude=a.lat,longitude=a.lon,start=start.strftime('%Y%m%d'),end=end.strftime('%Y%m%d'),format='JSON',**{'time-standard':'LST'}))
d=json.load(urllib.request.urlopen(u,timeout=30));assert d['type']=='Feature' and d['header']['time_standard']=='LST';assert abs(d['geometry']['coordinates'][0]-a.lon)<.025 and abs(d['geometry']['coordinates'][1]-a.lat)<.025
assert 'fill_value' in d['header']
for k,unit in [('PRECTOTCORR','mm/day'),('T2M_MAX','C'),('T2M_MIN','C'),('T2M','C'),('TS','C')]:assert d['parameters'][k]['units']==unit and d['properties']['parameter'][k]
out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(d,separators=(',',':')));out.with_suffix('.provenance.json').write_text(json.dumps({'query':u,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'real','processing':'Raw POWER JSON; no interpolation; normalize using provider fill, ranges and LST checks'},indent=2));print('Validated snapshot saved:',out)
