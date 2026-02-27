from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import re

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import Listing
from app.exceptions import ResourceNotFoundException, ValidationException

router = APIRouter()


def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/embed\/([^&\n?#]+)',
        r'youtube\.com\/v\/([^&\n?#]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValidationException("Invalid YouTube URL")


def extract_vimeo_id(url: str) -> str:
    """Extract Vimeo video ID from URL."""
    match = re.search(r'vimeo\.com\/(\d+)', url)
    if match:
        return match.group(1)
    
    raise ValidationException("Invalid Vimeo URL")


@router.post("/listings/{listing_id}/videos")
def add_video_to_listing(
    listing_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add video URL to listing."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Check ownership
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    video_type = data.get("type")  # youtube, vimeo, tour
    video_url = data.get("url")
    
    if not video_type or not video_url:
        raise ValidationException("Video type and URL required")
    
    # Validate and extract video ID
    try:
        if video_type == "youtube":
            video_id = extract_youtube_id(video_url)
            listing.youtube_video_url = f"https://www.youtube.com/embed/{video_id}"
        elif video_type == "vimeo":
            video_id = extract_vimeo_id(video_url)
            listing.vimeo_video_url = f"https://player.vimeo.com/video/{video_id}"
        elif video_type == "tour":
            listing.video_tour_url = video_url
        else:
            raise ValidationException("Invalid video type")
        
        listing.has_video = True
        db.commit()
        
        return {
            "success": True,
            "video_type": video_type,
            "embed_url": video_url
        }
        
    except ValidationException as e:
        raise e
    except Exception as e:
        raise ValidationException(f"Failed to process video URL: {str(e)}")


@router.get("/listings/{listing_id}/videos")
def get_listing_videos(
    listing_id: int,
    db: Session = Depends(get_db)
):
    """Get all videos for a listing."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    videos = []
    
    if listing.youtube_video_url:
        videos.append({
            "type": "youtube",
            "url": listing.youtube_video_url,
            "thumbnail": f"https://img.youtube.com/vi/{listing.youtube_video_url.split('/')[-1]}/maxresdefault.jpg"
        })
    
    if listing.vimeo_video_url:
        videos.append({
            "type": "vimeo",
            "url": listing.vimeo_video_url
        })
    
    if listing.video_tour_url:
        videos.append({
            "type": "tour",
            "url": listing.video_tour_url
        })
    
    return {
        "listing_id": listing_id,
        "has_video": listing.has_video,
        "videos": videos
    }


@router.delete("/listings/{listing_id}/videos/{video_type}")
def remove_video_from_listing(
    listing_id: int,
    video_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove video from listing."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    
    if not listing:
        raise ResourceNotFoundException("Listing", listing_id)
    
    # Check ownership
    if listing.user_id != current_user.id and current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if video_type == "youtube":
        listing.youtube_video_url = None
    elif video_type == "vimeo":
        listing.vimeo_video_url = None
    elif video_type == "tour":
        listing.video_tour_url = None
    else:
        raise ValidationException("Invalid video type")
    
    # Update has_video flag
    listing.has_video = bool(
        listing.youtube_video_url or 
        listing.vimeo_video_url or 
        listing.video_tour_url
    )
    
    db.commit()
    
    return {"success": True, "message": f"{video_type} video removed"}
