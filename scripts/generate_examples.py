"""Deterministic synthetic fixtures. Never read by real-data weather adapter."""
import json,math,pathlib,datetime,random
ROOT=pathlib.Path(__file__).resolve().parents[1]/'public/data'
def dump(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,separators=(',',':')))
def generate(sites):
 for idx,site in enumerate(sites):
  rng=random.Random(1701+idx);days=[];moisture=[];ndvi=[];start=datetime.date(2016,1,1);end=datetime.date(2025,12,31);d=start
  while d<=end:
   t=(d-start).days;season=math.cos(2*math.pi*(d.timetuple().tm_yday-20)/365.25);south=site['region']=='Southern Basin';center=(18 if south else 21)+9*season+rng.uniform(-3,3);rain=round((rng.expovariate(1/9) if rng.random()<(0.20 if south else .23) else 0)*(1-.25*season if south else 1+.15*season),2)
   maximum=round(center+7+rng.uniform(-2,2),2);minimum=round(center-8+rng.uniform(-2,2),2);status='valid'
   if d.isoformat() in ['2025-11-15','2024-03-11','2020-08-07']:maximum=None;rain=None;status='missing'
   if d.isoformat() in ['2025-11-13','2025-11-14','2025-11-16','2025-11-17']:maximum=37
   days.append(dict(date=d.isoformat(),rain=rain,max=maximum,min=minimum,mean=round(center,2),skin=round(center+2.8,2),status=status))
   surface=round(.18-.055*season+.025*math.sin(t/9),3);root=round(.24-.035*season+.018*math.sin(t/24),3);missing=t%139==0
   moisture.append(dict(date=d.isoformat(),surface=None if missing else surface,root=None if missing else root,status='missing' if missing else 'valid'))
   if t%16==0:ndvi.append(dict(date=d.isoformat(),value=None if t%144==0 else round(.39-.19*season+.05*math.sin(t/33),3),status='masked' if t%144==0 else 'valid'))
   d+=datetime.timedelta(days=1)
  grid=[]
  for y in range(5):
   for x in range(5):
    grid.append(dict(lon=site['lon']+(x-2)*.094,lat=site['lat']+(y-2)*.081,surface=None if (x,y)==(1,3) else round(.09+.04*x+.015*y,3),root=None if (x,y)==(1,3) else round(.16+.025*x+.018*y,3),status='masked' if (x,y)==(1,3) else 'valid'))
  flood=[]
  for i in range(100):
   x=i%10;y=i//10;permanent=x in [4,5] and y<8;ref='water' if permanent else 'land';event='water' if permanent or (x in [3,6,7] and y in [3,4,5,6]) else 'land'
   if i%17==0:ref='masked'
   if i%19==0:event='masked'
   flood.append(dict(id=i,ref=ref,event=event,permanent=permanent,areaKm2=.0009))
  imagery=[]
  for frame,dt in enumerate(['2025-09-14','2025-10-22','2025-11-08']):
   if frame==1:imagery.append(dict(date=dt,asset=None,status='cloud-masked',validPercent=12));continue
   name=f'example/imagery/{site["id"]}-{dt}.svg';r=random.Random(200+idx);rects=[]
   for y in range(12):
    for x in range(18):
     shade=r.randrange(25);green=['#586b3b','#75854b','#9b9a5a','#6a8046','#879757'][r.randrange(5)] if frame==0 else ['#92805a','#ad9463','#b19d72','#8a8554','#6c7950'][r.randrange(5)]
     rects.append(f'<rect x="{x*40}" y="{y*40}" width="38" height="38" fill="{green}"/>')
   svg='<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><rect width="720" height="480" fill="#46483c"/>'+''.join(rects)+'<path d="M270 0 Q370 100 300 210 T350 480" fill="none" stroke="#385b61" stroke-width="20"/><text x="16" y="462" fill="white" font-family="sans-serif" font-size="16">AI-generated schematic · '+dt+'</text></svg>'
   (ROOT/name).parent.mkdir(parents=True,exist_ok=True);(ROOT/name).write_text(svg);imagery.append(dict(date=dt,asset=name,status='valid',validPercent=96 if frame==0 else 92))
  meta={k:dict(source='SYNTHETIC '+label,resolution=res,start=st,end=en,qa='Generated valid/masked fixture; no observations',timeStandard='Synthetic LST-style calendar') for k,label,res,st,en in [('imerg','IMERG Final-style daily','0.1° example support','2016-01-01','2025-12-31'),('late','IMERG Late-style provisional','0.1° example support','2025-12-02','2025-12-31'),('grid','SMAP-style grid','9 km synthetic cells','2025-10-15','2025-10-15'),('moisture','SMAP-style daily moisture','9 km synthetic support','2016-01-01','2025-12-31'),('flood','OPERA-style classification','30 m synthetic pixels','2025-09-14','2025-11-08'),('imagery','HLS-style schematic','Schematic RGB; not satellite imagery','2025-09-14','2025-11-08'),('ndvi','MODIS-style greenness','250 m / 16-day synthetic support','2016-01-01','2025-12-31'),('et','ET context fixture','500 m synthetic support','2025-10-01','2025-10-31')]}
  imerg=[dict(d,rain=None if d['rain'] is None else round(d['rain']*1.12,2),max=None,min=None,mean=None,skin=None) for d in days]
  et=[dict(date=f'2025-10-{i:02}',actualET=round(2.1+.5*math.sin(i),2) if i!=14 else None,referenceET=round(4.2+.8*math.sin(i/3),2),esi=round(.6+.1*math.cos(i),2),status='missing' if i==14 else 'valid') for i in range(1,32)]
  dump(ROOT/'example'/f'{site["id"]}.json',dict(meta=meta,imerg=imerg,late=imerg[-30:],et=et,clayPercent=42,mode='example',version='1.0.0',locationId=site['id'],days=days,moisture=moisture,ndvi=ndvi,grid=grid,flood=flood,imagery=imagery,octoberMoisture=.26,soilPH=6.2))
if __name__=='__main__':generate(json.loads((ROOT/'manifest.json').read_text())['sites'])
