import asyncio
import io
import os
import shutil
import pytest
from PIL import Image
from fastapi import HTTPException

from main import upload_handler, FileValidator, UploadConfig


class DummyUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self):
        return self._content


def make_image_bytes(fmt="JPEG", size=(100, 100), color=(255, 0, 0)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_check_magic_number():
    assert FileValidator.check_magic_number(b"\xFF\xD8\xFFrest") == "image/jpeg"
    assert FileValidator.check_magic_number(b"\x89\x50\x4E\x47rest") == "image/png"


@pytest.mark.asyncio
async def test_upload_success(tmp_path):
    # Point upload dirs to temporary path
    old_upload = UploadConfig.UPLOAD_DIR
    old_temp = UploadConfig.TEMP_DIR
    UploadConfig.UPLOAD_DIR = tmp_path / "uploads"
    UploadConfig.TEMP_DIR = tmp_path / "temp"
    UploadConfig.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    UploadConfig.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        content = make_image_bytes()
        file = DummyUploadFile("test.jpg", content)
        res = await upload_handler.upload_and_process_image(file=file, user_id=1)
        assert "url" in res
        assert res["optimized"] is True
        assert (UploadConfig.UPLOAD_DIR / res["filename"]).exists()
        assert (UploadConfig.UPLOAD_DIR / ("thumb_" + res["filename"])).exists()
        # Temp dir should be cleaned up
        assert not any(UploadConfig.TEMP_DIR.iterdir())
    finally:
        UploadConfig.UPLOAD_DIR = old_upload
        UploadConfig.TEMP_DIR = old_temp


@pytest.mark.asyncio
async def test_virus_detection(monkeypatch, tmp_path):
    old_upload = UploadConfig.UPLOAD_DIR
    old_temp = UploadConfig.TEMP_DIR
    UploadConfig.UPLOAD_DIR = tmp_path / "uploads"
    UploadConfig.TEMP_DIR = tmp_path / "temp"
    UploadConfig.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    UploadConfig.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    async def fake_scan(path):
        return False, "EICAR detected"

    monkeypatch.setattr(FileValidator, "scan_for_viruses", staticmethod(fake_scan))

    try:
        content = make_image_bytes()
        file = DummyUploadFile("test.jpg", content)
        with pytest.raises(HTTPException) as exc:
            await upload_handler.upload_and_process_image(file=file, user_id=1)
        assert exc.value.status_code == 400
        assert "File failed security scan" in exc.value.detail
    finally:
        UploadConfig.UPLOAD_DIR = old_upload
        UploadConfig.TEMP_DIR = old_temp


@pytest.mark.asyncio
async def test_extension_mismatch(tmp_path):
    old_upload = UploadConfig.UPLOAD_DIR
    old_temp = UploadConfig.TEMP_DIR
    UploadConfig.UPLOAD_DIR = tmp_path / "uploads"
    UploadConfig.TEMP_DIR = tmp_path / "temp"
    UploadConfig.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    UploadConfig.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # Create PNG bytes but filename .jpg
        content = make_image_bytes(fmt="PNG")
        file = DummyUploadFile("test.jpg", content)
        with pytest.raises(HTTPException) as exc:
            await upload_handler.upload_and_process_image(file=file, user_id=1)
        assert exc.value.status_code == 400
        assert "File extension" in str(exc.value.detail) or "File type not allowed" in str(exc.value.detail)
    finally:
        UploadConfig.UPLOAD_DIR = old_upload
        UploadConfig.TEMP_DIR = old_temp


@pytest.mark.asyncio
async def test_file_too_large(tmp_path):
    old_upload = UploadConfig.UPLOAD_DIR
    old_temp = UploadConfig.TEMP_DIR
    UploadConfig.UPLOAD_DIR = tmp_path / "uploads"
    UploadConfig.TEMP_DIR = tmp_path / "temp"
    UploadConfig.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    UploadConfig.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        content = b"a" * (UploadConfig.MAX_FILE_SIZE + 1)
        file = DummyUploadFile("big.jpg", content)
        with pytest.raises(HTTPException) as exc:
            await upload_handler.upload_and_process_image(file=file, user_id=1)
        assert exc.value.status_code == 400
        assert "File too large" in exc.value.detail
    finally:
        UploadConfig.UPLOAD_DIR = old_upload
        UploadConfig.TEMP_DIR = old_temp
