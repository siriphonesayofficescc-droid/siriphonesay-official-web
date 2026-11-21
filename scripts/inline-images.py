"""Inline /images/* and /favicon.png references into dist-preview/index.html as data URIs."""
import base64, re, pathlib, mimetypes
root = pathlib.Path(__file__).resolve().parent.parent
html_path = root / 'dist-preview' / 'index.html'
html = html_path.read_text(encoding='utf-8')
def to_data(m):
    rel = m.group(0)
    f = root / 'public' / rel.lstrip('./')
    if not f.exists():
        return rel
    mime = mimetypes.guess_type(f.name)[0] or ('image/webp' if f.suffix == '.webp' else 'model/gltf-binary' if f.suffix == '.glb' else 'application/octet-stream')
    return f'data:{mime};base64,' + base64.b64encode(f.read_bytes()).decode()
# 3D models (.glb) are NOT inlined: the preview's security policy blocks loading data: URLs with fetch,
# so they are published as separate files next to index.html (see docs)
html = re.sub(r'\.?/(?:images|catalog)/[A-Za-z0-9_\-/]+\.(?:webp|png|jpg)|\.?/favicon\.png', to_data, html)
html_path.write_text(html, encoding='utf-8')
print('inlined ->', html_path, round(len(html) / 1e6, 2), 'MB')
