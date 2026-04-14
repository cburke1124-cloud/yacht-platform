import re, json
from bs4 import BeautifulSoup

f = open(
    r'c:\Users\cburk\AppData\Roaming\Code\User\workspaceStorage\0b95076fd4ccdebd1062f59f41c4dc51\GitHub.copilot-chat\chat-session-resources\5ae42e6f-ddd3-4b04-9580-d525b6e8784d\toolu_vrtx_014zrEZqvzN8Y6AkZtsjRyGk__vscode-1775667219456\content.txt',
    encoding='utf-8'
).read()

imgs = re.findall(r'https://images\.boatsgroup\.com/[^\s<>"\' ]+\.jpg', f)
print(f"Total boatsgroup image refs: {len(imgs)}")
ids = sorted(set(
    re.search(r'(\d{7,})', u).group(1) if re.search(r'(\d{7,})', u) else ''
    for u in imgs
) - {''})
print(f"Distinct listing IDs: {ids}")
print(f"Unique URLs: {len(set(imgs))}")

# Parse HTML for structural analysis
soup = BeautifulSoup(f, 'html.parser')

# Find how many img tags have data-lazy-src pointing to boatsgroup
lazy_imgs = [t for t in soup.find_all('img') if 'boatsgroup.com' in (t.get('data-lazy-src') or '')]
print(f"\nImgs with data-lazy-src pointing to boatsgroup: {len(lazy_imgs)}")

# Find the modal/lightbox
modals = soup.find_all(attrs={'role': 'dialog'})
print(f"role=dialog elements: {len(modals)}")
for m in modals:
    modal_imgs = [t for t in m.find_all('img') if 'boatsgroup.com' in (t.get('data-lazy-src') or '')]
    print(f"  modal id={m.get('id')} class={m.get('class')} -> {len(modal_imgs)} boatsgroup imgs inside")

# Find images OUTSIDE the modal
modal_img_srcs = set()
for m in modals:
    for t in m.find_all('img'):
        s = t.get('data-lazy-src') or t.get('src') or ''
        if 'boatsgroup.com' in s:
            modal_img_srcs.add(s)

outside_imgs = []
for t in soup.find_all('img'):
    s = t.get('data-lazy-src') or t.get('src') or ''
    if 'boatsgroup.com' in s and s not in modal_img_srcs:
        outside_imgs.append((s, t.get('class'), t.parent.name if t.parent else None))

print(f"\nBoatsgroup imgs OUTSIDE modals: {len(outside_imgs)}")
for url, cls, parent in outside_imgs[:10]:
    print(f"  parent={parent} class={cls} url={url[:80]}")

# Look for any 'featured' content sections
featured = soup.find_all(class_=re.compile(r'featured', re.I))
print(f"\nElements with 'featured' in class: {len(featured)}")
for el in featured[:5]:
    print(f"  tag={el.name} class={el.get('class')} id={el.get('id')}")

# Find slide containers outside the modal
slide_containers = soup.find_all(class_=re.compile(r'x-slide-container', re.I))
print(f"\nx-slide-container elements: {len(slide_containers)}")
for sc in slide_containers:
    imgs_in = sc.find_all('img')
    print(f"  classes={sc.get('class')} images_inside={len(imgs_in)}")
