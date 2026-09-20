from pathlib import Path
from urllib.request import urlopen
import subprocess

BASE = 'https://raw.githubusercontent.com/b89324/-bite-pomodoro-magic40-rc3-preview-/ef07b1821956bba4f0ee32b47a4a3b3117369251/'
for line in Path('scripts/shared-assets.sha').read_text().splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    expected, name = line.split()
    if '/' in name or name.startswith('.'):
        raise SystemExit('Invalid asset path')
    target = Path('_site') / name
    target.write_bytes(urlopen(BASE + name, timeout=30).read())
    actual = subprocess.check_output(['git', 'hash-object', str(target)], text=True).strip()
    if actual != expected:
        raise SystemExit('SHA mismatch: ' + name)
    print('Verified ' + name)
