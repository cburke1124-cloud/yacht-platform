import re
from bs4 import BeautifulSoup
from urllib.parse import urlparse

f = open(
    r'c:\Users\cburk\AppData\Roaming\Code\User\workspaceStorage\0b95076fd4ccdebd1062f59f41c4dc51\GitHub.copilot-chat\chat-session-resources\5ae42e6f-ddd3-4b04-9580-d525b6e8784d\toolu_vrtx_014zrEZqvzN8Y6AkZtsjRyGk__vscode-1775667219456\content.txt',
    encoding='utf-8'
).read()

soup = BeautifulSoup(f, 'html.parser')

# Simulate what extract_images currently does -- collect ALL img src candidates
# mimicking P3 scanner
skip_re = re.compile(
    r'logo|icon|avatar|banner|/ad|spacer|pixel|tracking|'
    r'x-out|xout|spinner|placeholder|no.image|no_image|'
    r'/ui/|/icons?/|/buttons?/|'
    r'headshot|portrait|/agents?/|/brokers?/|/staff/|/team-member|/salesperson|'
    r'(?:White|Dark|Black|Light|Color|Grey|Gray)\.(?:png|svg)|'
    r'facebook|instagram|twitter|linkedin|youtube|tiktok|snapchat|'
    r'pinterest|whatsapp|reddit|vimeo|tumblr|signal|telegram|'
    r'social|share-btn|share_btn|'
    r'yelp|tripadvisor|trustpilot|google.review|/feedbacks/',
    re.IGNORECASE,
)
img_ext_re = re.compile(r'\.(jpg|jpeg|png|webp)(\?.*)?$', re.IGNORECASE)

collected = []
seen = set()
def _add(url_str):
    if not url_str or url_str.startswith('data:'):
        return
    if not url_str.startswith('http'):
        return
    base_path = url_str.split('?')[0]
    if not img_ext_re.search(base_path) and not img_ext_re.search(url_str):
        return
    norm = base_path if img_ext_re.search(base_path) else url_str
    if norm in seen or skip_re.search(base_path):
        return
    seen.add(norm)
    collected.append(url_str)

# P1: <a href="...jpg">
for a in soup.find_all('a', href=True):
    _add(a['href'].strip())

# P2: data-fancybox etc
for elem in soup.find_all(attrs={}):
    for attr in ('data-fancybox', 'data-lightbox', 'data-photoswipe', 'data-gallery'):
        if elem.get(attr) is not None:
            for src_attr in ('href', 'data-src', 'data-full', 'data-zoom', 'src'):
                val = elem.get(src_attr, '')
                if val:
                    _add(val.strip())
                    break

_social_alt_re = re.compile(
    r'facebook|instagram|twitter|linkedin|youtube|tiktok|snapchat|'
    r'pinterest|whatsapp|reddit|vimeo|tumblr|yelp|tripadvisor|trustpilot',
    re.IGNORECASE,
)

# P3: all img tags
for img in soup.find_all('img'):
    src = (
        img.get('data-original') or img.get('data-zoom-image') or
        img.get('data-full') or img.get('data-large') or
        img.get('data-lazy-src') or img.get('data-src') or img.get('src')
    )
    if not src and img.get('srcset'):
        candidates = [s.strip().split()[0] for s in img['srcset'].split(',') if s.strip()]
        src = candidates[-1] if candidates else None
    alt_text = (img.get('alt') or '').lower()
    _w_attr, _h_attr = img.get('width', ''), img.get('height', '')
    try:
        _is_small_square = (_w_attr and _h_attr
                            and int(float(_w_attr)) == int(float(_h_attr))
                            and int(float(_w_attr)) <= 600)
    except (ValueError, TypeError):
        _is_small_square = False
    if src and not _is_small_square and 'logo' not in alt_text and 'icon' not in alt_text and not _social_alt_re.search(alt_text) and not src.startswith('data:'):
        _add(src.strip())

print(f"Total images collected by P1+P2+P3: {len(collected)}")
print("\nAll images collected:")
for i, url in enumerate(collected):
    domain = urlparse(url).netloc
    print(f"  [{i+1}] {domain}: {url[-(min(60, len(url))):] if len(url) > 80 else url}")
