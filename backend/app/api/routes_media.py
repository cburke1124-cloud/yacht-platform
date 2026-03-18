from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
import os
from PIL import Image
import io
import shutil
import subprocess
import tempfile

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.media import MediaFile
from app.models.listing import Listing
from app.exceptions import ValidationException, ResourceNotFoundException
from app.services.media_storage import store_media_bytes, delete_media_by_url

router = APIRouter()

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_PDF_TYPES = ["application/pdf"]


def optimize_image(file_content: bytes, max_width: int = 1920) -> tuple[bytes, bytes, int, int]:
    """Optimize image and create thumbnail."""
    img = Image.open(io.BytesIO(file_content))
    img = ImageOps.exif_transpose(img)
    
    # Get original dimensions
    width, height = img.size
    
    # Convert RGBA/P to RGB for WebP-safe output
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        if img.mode in ('RGBA', 'LA'):
            background.paste(img, mask=img.split()[-1])
            img = background
    
    # Resize if too wide
    if width > max_width:
        ratio = max_width / width
        new_height = int(height * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        width, height = img.size

    # Guard against extremely large megapixel uploads
    max_pixels = 4_000_000
    if width * height > max_pixels:
        scale = (max_pixels / (width * height)) ** 0.5
        resized = (max(1, int(width * scale)), max(1, int(height * scale)))
        img = img.resize(resized, Image.Resampling.LANCZOS)
        width, height = img.size
    
    # Save optimized image as WebP
    output = io.BytesIO()
    img.save(output, format='WEBP', quality=82, method=6)
    optimized_content = output.getvalue()
    
    # Create thumbnail (WebP)
    thumb_img = img.copy()
    thumb_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
    thumb_output = io.BytesIO()
    thumb_img.save(thumb_output, format='WEBP', quality=75, method=6)
    thumbnail_content = thumb_output.getvalue()
    
    return optimized_content, thumbnail_content, width, height


def optimize_video(file_content: bytes) -> tuple[bytes, Optional[bytes]]:
    """Optimize video to MP4 (H.264/AAC) when ffmpeg is available.
    Returns (video_bytes, thumbnail_bytes).
    """
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        return file_content, None

    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = os.path.join(temp_dir, "input_video")
        output_path = os.path.join(temp_dir, "optimized.mp4")
        thumb_path = os.path.join(temp_dir, "thumb.jpg")

        with open(input_path, "wb") as infile:
            infile.write(file_content)

        # Compress video while preserving compatibility for web playback
        transcode_cmd = [
            ffmpeg_path,
            "-y",
            "-i",
            input_path,
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "28",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output_path,
        ]

        result = subprocess.run(transcode_cmd, capture_output=True)
        if result.returncode != 0 or not os.path.exists(output_path):
            return file_content, None

        # Generate thumbnail at ~1 second
        thumb_cmd = [
            ffmpeg_path,
            "-y",
            "-ss",
            "00:00:01",
            "-i",
            output_path,
            "-frames:v",
            "1",
            "-q:v",
            "4",
            thumb_path,
        ]
        subprocess.run(thumb_cmd, capture_output=True)

        with open(output_path, "rb") as outfile:
            optimized_video = outfile.read()

        thumbnail_content = None
        if os.path.exists(thumb_path):
            with open(thumb_path, "rb") as thumb_file:
                thumbnail_content = thumb_file.read()

        return optimized_video, thumbnail_content


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    listing_id: Optional[int] = Form(None),
    folder_id: Optional[int] = Form(None),
    alt_text: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a media file (image, video, or PDF)"""
    
    # Read file
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise ValidationException(f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB")
    
    # Determine file type
    if file.content_type in ALLOWED_IMAGE_TYPES:
        file_type = 'image'
    elif file.content_type in ALLOWED_VIDEO_TYPES:
        file_type = 'video'
    elif file.content_type in ALLOWED_PDF_TYPES:
        file_type = 'pdf'
    else:
        raise ValidationException(f"Unsupported file type: {file.content_type}")
    
    # Generate filename
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    width = None
    height = None
    thumbnail_url = None
    file_url = None
    
    # Process based on type
    if file_type == 'image':
        # Optimize image
        try:
            optimized_content, thumbnail_content, width, height = optimize_image(content)
            
            # Save thumbnail
            base_name = os.path.splitext(safe_filename)[0]
            optimized_filename = f"{base_name}.webp"
            thumb_filename = f"{base_name}_thumb.webp"
            file_url = store_media_bytes(optimized_filename, optimized_content, "image/webp")
            thumbnail_url = store_media_bytes(thumb_filename, thumbnail_content, "image/webp")
            safe_filename = optimized_filename
            content = optimized_content  # Update content for size calculation
        except Exception:
            # If optimization fails, save original
            file_url = store_media_bytes(safe_filename, content, file.content_type)
    elif file_type == 'video':
        try:
            optimized_video, video_thumb = optimize_video(content)
            base_name = os.path.splitext(safe_filename)[0]
            optimized_filename = f"{base_name}.mp4"
            file_url = store_media_bytes(optimized_filename, optimized_video, "video/mp4")
            safe_filename = optimized_filename
            content = optimized_video

            if video_thumb:
                thumb_filename = f"{base_name}_thumb.jpg"
                thumbnail_url = store_media_bytes(thumb_filename, video_thumb, "image/jpeg")
        except Exception:
            file_url = store_media_bytes(safe_filename, content, file.content_type)
    else:
        # Save as-is for videos and PDFs
        file_url = store_media_bytes(safe_filename, content, file.content_type)

    if not file_url:
        file_url = store_media_bytes(safe_filename, content, file.content_type)
    
    # Create media record - ✅ CHANGED: user_id only
    media = MediaFile(
        user_id=current_user.id,  # ✅ CHANGED from owner_id
        folder_id=folder_id,
        filename=safe_filename,
        url=file_url,
        thumbnail_url=thumbnail_url,
        file_type=file_type,
        file_size_mb=len(content) / (1024 * 1024),
        width=width,
        height=height,
        alt_text=alt_text,
        caption=caption
    )
    
    db.add(media)
    db.commit()
    db.refresh(media)
    
    return {
        "success": True,
        "media": {
            "id": media.id,
            "url": media.url,
            "thumbnail_url": media.thumbnail_url,
            "file_type": media.file_type,
            "filename": media.filename,
            "width": media.width,
            "height": media.height
        }
    }


@router.post("/bulk-upload")
async def bulk_upload_media(
    files: List[UploadFile] = File(...),
    listing_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple media files at once"""
    results = []
    
    for file in files:
        try:
            content = await file.read()
            
            if len(content) > MAX_FILE_SIZE:
                results.append({"filename": file.filename, "success": False, "error": "File too large"})
                continue
            
            # Determine file type
            if file.content_type in ALLOWED_IMAGE_TYPES:
                file_type = 'image'
            elif file.content_type in ALLOWED_VIDEO_TYPES:
                file_type = 'video'
            elif file.content_type in ALLOWED_PDF_TYPES:
                file_type = 'pdf'
            else:
                results.append({"filename": file.filename, "success": False, "error": "Unsupported type"})
                continue
            
            # Process file
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
            safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
            width = None
            height = None
            thumbnail_url = None
            file_url = None
            
            if file_type == 'image':
                try:
                    optimized_content, thumbnail_content, width, height = optimize_image(content)
                    
                    base_name = os.path.splitext(safe_filename)[0]
                    optimized_filename = f"{base_name}.webp"
                    thumb_filename = f"{base_name}_thumb.webp"
                    file_url = store_media_bytes(optimized_filename, optimized_content, "image/webp")
                    thumbnail_url = store_media_bytes(thumb_filename, thumbnail_content, "image/webp")
                    safe_filename = optimized_filename
                    content = optimized_content
                except:
                    file_url = store_media_bytes(safe_filename, content, file.content_type)
            elif file_type == 'video':
                try:
                    optimized_video, video_thumb = optimize_video(content)
                    base_name = os.path.splitext(safe_filename)[0]
                    optimized_filename = f"{base_name}.mp4"
                    file_url = store_media_bytes(optimized_filename, optimized_video, "video/mp4")
                    safe_filename = optimized_filename
                    content = optimized_video

                    if video_thumb:
                        thumb_filename = f"{base_name}_thumb.jpg"
                        thumbnail_url = store_media_bytes(thumb_filename, video_thumb, "image/jpeg")
                except:
                    file_url = store_media_bytes(safe_filename, content, file.content_type)
            else:
                file_url = store_media_bytes(safe_filename, content, file.content_type)

            if not file_url:
                file_url = store_media_bytes(safe_filename, content, file.content_type)
            
            # Create media record - ✅ CHANGED
            media = MediaFile(
                user_id=current_user.id,  # ✅ CHANGED from owner_id
                filename=safe_filename,
                url=file_url,
                thumbnail_url=thumbnail_url,
                file_type=file_type,
                file_size_mb=len(content) / (1024 * 1024),
                width=width,
                height=height
            )
            
            db.add(media)
            results.append({
                "filename": file.filename,
                "success": True,
                "media_id": None  # Will be set after commit
            })
            
        except Exception as e:
            results.append({"filename": file.filename, "success": False, "error": str(e)})
    
    db.commit()
    
    # Update media IDs in results - ✅ CHANGED
    media_files = db.query(MediaFile).filter(
        MediaFile.user_id == current_user.id  # ✅ CHANGED from owner_id
    ).order_by(MediaFile.created_at.desc()).limit(len(results)).all()
    
    for i, result in enumerate(results):
        if result["success"] and i < len(media_files):
            result["media_id"] = media_files[i].id
            result["url"] = media_files[i].url
    
    return {
        "success": True,
        "total": len(files),
        "uploaded": len([r for r in results if r["success"]]),
        "results": results
    }


@router.get("/my-media")
def get_my_media(
    skip: int = 0,
    limit: int = 50,
    file_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get media files for the current user's company (dealer + their team members)."""
    # Determine the root dealer for this user
    root_dealer_id = current_user.parent_dealer_id or current_user.id

    # Collect all user IDs in the same organisation
    team_ids = (
        db.query(User.id)
        .filter(
            (User.id == root_dealer_id) |
            (User.parent_dealer_id == root_dealer_id)
        )
        .all()
    )
    org_ids = [row[0] for row in team_ids] or [current_user.id]

    query = db.query(MediaFile).filter(
        MediaFile.user_id.in_(org_ids),
        MediaFile.deleted_at == None
    )
    
    if file_type:
        query = query.filter(MediaFile.file_type == file_type)
    
    total = query.count()
    media = query.order_by(MediaFile.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "media": [
            {
                "id": m.id,
                "filename": m.filename,
                "url": m.url,
                "thumbnail_url": m.thumbnail_url,
                "file_type": m.file_type,
                "file_size_mb": m.file_size_mb,
                "width": m.width,
                "height": m.height,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in media
        ]
    }


@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a media file"""
    media = db.query(MediaFile).filter(
        MediaFile.id == media_id,
        MediaFile.user_id == current_user.id  # ✅ CHANGED from owner_id
    ).first()
    
    if not media:
        raise ResourceNotFoundException("Media", media_id)
    
    # Soft delete
    media.deleted_at = datetime.utcnow()
    
    try:
        delete_media_by_url(media.url)
        delete_media_by_url(media.thumbnail_url)
    except:
        pass
    
    db.commit()
    
    return {"success": True}


@router.get("/stats")
def get_media_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's media statistics"""
    stats = db.query(
        func.count(MediaFile.id).label('total_files'),
        func.sum(MediaFile.file_size_mb).label('total_size_mb'),
        func.count(MediaFile.id).filter(MediaFile.file_type == 'image').label('images'),
        func.count(MediaFile.id).filter(MediaFile.file_type == 'video').label('videos'),
        func.count(MediaFile.id).filter(MediaFile.file_type == 'pdf').label('pdfs')
    ).filter(
        MediaFile.user_id == current_user.id,  # ✅ CHANGED from owner_id
        MediaFile.deleted_at == None
    ).first()
    
    return {
        "total_files": stats.total_files or 0,
        "total_size_gb": (stats.total_size_mb or 0) / 1024,
        "images": stats.images or 0,
        "videos": stats.videos or 0,
        "pdfs": stats.pdfs or 0
    }