from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import re

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.media import MediaFile
from app.exceptions import ValidationException, ResourceNotFoundException

router = APIRouter()


def extract_youtube_id(url: str) -> str | None:
    patterns = [
        r"(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)",
        r"youtube\.com\/embed\/([^&\n?#]+)",
        r"youtube\.com\/v\/([^&\n?#]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_vimeo_id(url: str) -> str | None:
    match = re.search(r"vimeo\.com\/(\d+)", url)
    return match.group(1) if match else None


@router.post("/media/video-embed")
def add_video_embed(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add YouTube or Vimeo video as a MediaFile entry."""
    video_url = data.get("url", "").strip()
    video_type = data.get("type", "youtube")
    folder_id = data.get("folder_id")

    if not video_url:
        raise ValidationException("Video URL is required")

    if video_type == "youtube":
        video_id = extract_youtube_id(video_url)
        if not video_id:
            raise ValidationException("Invalid YouTube URL")
        embed_url = f"https://www.youtube.com/embed/{video_id}"
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        filename = f"YouTube: {video_id}"

    elif video_type == "vimeo":
        video_id = extract_vimeo_id(video_url)
        if not video_id:
            raise ValidationException("Invalid Vimeo URL")
        embed_url = f"https://player.vimeo.com/video/{video_id}"
        thumbnail_url = None
        filename = f"Vimeo: {video_id}"

    elif video_type == "tour":
        embed_url = video_url
        thumbnail_url = None
        filename = "Virtual Tour"

    else:
        raise ValidationException("Invalid video type. Use: youtube, vimeo, tour")

    # Use user_id only — matches the cleaned-up MediaFile model
    media = MediaFile(
        user_id=current_user.id,
        folder_id=folder_id,
        filename=filename,
        url=embed_url,
        thumbnail_url=thumbnail_url,
        file_type="video",
        file_size_mb=0,
        alt_text=data.get("alt_text", f"{video_type.title()} video"),
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        "id": media.id,
        "url": media.url,
        "thumbnail_url": media.thumbnail_url,
        "file_type": media.file_type,
        "video_type": video_type,
    }


@router.get("/media/{media_id}/video-type")
def get_video_type(media_id: int, db: Session = Depends(get_db)):
    media = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not media:
        raise ResourceNotFoundException("Media", media_id)

    video_type = None
    is_embed = False
    if media.file_type == "video":
        if "youtube.com" in media.url:
            video_type = "youtube"
            is_embed = True
        elif "vimeo.com" in media.url:
            video_type = "vimeo"
            is_embed = True
        elif media.url.startswith("http"):
            video_type = "tour"
            is_embed = True

    return {
        "media_id": media.id,
        "is_video": media.file_type == "video",
        "is_embed": is_embed,
        "video_type": video_type,
        "url": media.url,
        "thumbnail_url": media.thumbnail_url,
    }