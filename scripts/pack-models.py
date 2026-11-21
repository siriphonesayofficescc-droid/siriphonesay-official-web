"""Preview build only: copy each catalogue model next to index.html as catalog/<id>/model.js
(the preview host serves only web files and blocks fetching data: URLs, so the GLB travels as a script).
Big models are split into model.part<N>.js files of at most ~12 MB each."""
import base64, pathlib
CHUNK = 12_000_000
root = pathlib.Path(__file__).resolve().parent.parent
for glb in sorted((root / 'public' / 'catalog').glob('*/model.glb')):
    key = f'catalog/{glb.parent.name}/model.js'
    out = root / 'dist-preview' / key
    out.parent.mkdir(parents=True, exist_ok=True)
    b64 = base64.b64encode(glb.read_bytes()).decode()
    if len(b64) <= CHUNK:
        out.write_text(f'(window.__SCC_MODELS=window.__SCC_MODELS||{{}})["{key}"]="{b64}";')
        print('packed', key, round(out.stat().st_size / 1e6, 1), 'MB')
        continue
    parts = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)]
    out.write_text(f'(window.__SCC_MODELS=window.__SCC_MODELS||{{}})["{key}"]={{parts:{len(parts)}}};')
    for i, p in enumerate(parts):
        (out.parent / f'model.part{i}.js').write_text(
            f'(window.__SCC_CHUNKS=window.__SCC_CHUNKS||{{}});(window.__SCC_CHUNKS["{key}"]=window.__SCC_CHUNKS["{key}"]||[])[{i}]="{p}";')
    print('packed', key, 'in', len(parts), 'parts')
