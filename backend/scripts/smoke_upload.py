import asyncio
import io
from PIL import Image
from main import upload_handler, UploadConfig, FileValidator

class DummyUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content
    async def read(self):
        return self._content


def make_image_bytes(fmt="JPEG", size=(50,50)):
    buf = io.BytesIO()
    Image.new('RGB', size, (255,0,0)).save(buf, format=fmt)
    return buf.getvalue()

async def run():
    UploadConfig.UPLOAD_DIR.mkdir(exist_ok=True)
    UploadConfig.TEMP_DIR.mkdir(exist_ok=True)
    content = make_image_bytes()
    f = DummyUploadFile('smoke.jpg', content)
    # monkeypatch scan to always return clean if clamd not available
    async def fake_scan(p):
        return True, 'Clean'
    FileValidator.scan_for_viruses = fake_scan
    res = await upload_handler.upload_and_process_image(f, user_id=999)
    print('Upload result:', res)

if __name__ == '__main__':
    asyncio.run(run())