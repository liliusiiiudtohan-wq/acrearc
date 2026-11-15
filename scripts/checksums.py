import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'public/data');d={f.relative_to(p).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and f.name!='checksums.json'};(p/'checksums.json').write_text(json.dumps(d,indent=2));print(len(d),'SHA-256 records')
