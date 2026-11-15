#!/usr/bin/env python3
"""Package the editable source and independently swappable runtime data. No credentials/caches."""
import argparse,pathlib,zipfile,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output-dir',default=str(root.parent/'deliverables'));a=p.parse_args();out=pathlib.Path(a.output_dir).resolve();out.mkdir(parents=True,exist_ok=True)
def allowed(f):
 if any(x in ['node_modules','.git','__pycache__','staging'] for x in f.relative_to(root).parts):return False
 if f.name.endswith(('.tsbuildinfo','.log','.pyc')):return False
 if f.name=='.env' or f.name.startswith('.env.') and f.name!='.env.example':return False
 return not f.is_relative_to(out)
def write(name,files):
 path=out/name
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for f,arc in files:z.write(f,arc)
 print(name,path.stat().st_size,'bytes');return path
files=[f for f in root.rglob('*') if f.is_file() and allowed(f)]
s=write('Field_Shift_Prototype_v01.zip',[(f,str(pathlib.Path('Field_Shift_Prototype')/f.relative_to(root))) for f in files])
data=[(f,str(f.relative_to(root))) for f in (root/'public/data').rglob('*') if f.is_file()]
for filename in ['DATA_CONTRACT.md','INGEST.md','SOURCE_REGISTER.md','KNOWN_GAPS.md']:
 f=root/'docs'/filename;data.append((f,'docs/'+filename))
for f in (root/'scripts').glob('*.py'):
 if f.name not in ['render_sample_pdf.py','package_release.py']:data.append((f,'scripts/'+f.name))
data.append((root/'scripts/requirements-ingest.txt','scripts/requirements-ingest.txt'))
readme=out/'DATA_PACK_README.md';readme.write_text('Extract this archive INSIDE Field_Shift_Prototype, merging public/data, scripts and docs. The source archive already contains the starter pack. Active path: public/data/manifest.json. Run npm run validate:data, npm test and npm run build after a swap. No credentials included. Read docs/DATA_CONTRACT.md and docs/INGEST.md.\n');data.append((readme,'DATA_PACK_README.md'))
d=write('Field_Shift_Data_v01.zip',data)
(out/'SHA256SUMS.txt').write_text('\n'.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.name for f in [s,d])+'\n')
