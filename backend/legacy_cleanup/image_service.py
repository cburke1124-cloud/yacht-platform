import os
import io
import hashlib
from datetime import datetime
from typing import Optional, Tuple, List
from PIL import Image, ImageOps
import requests
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ImageService:
    """Handle image upload, optimization, and processing"""
    
    def __init__(self):
        self.upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        self.allowed_formats = ['JPEG', 'PNG', 'WEBP']
        self.cdn_url = os.getenv("CDN_URL", "")
        
        # Image size configurations
        self.sizes = {
            'original': None,  # Keep original size
            'large': (1920, 1080),
            'medium': (1200, 675),
            'thumbnail': (400, 225),
            'card': (600, 338)
        }
        
        # Quality settings
        self.quality = {
            'original': 95,
            'large': 90,
            'medium': 85,
            'thumbnail': 80,
            'card': 85
        }
        
        # Ensure upload directory exists
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)
    
    def validate_image(self, file_content: bytes) -> Tuple[bool, Optional[str]]:
        """Validate image file"""
        # Check file size
        if len(file_content) > self.max_file_size:
            return False, f"File too large. Maximum size is {self.max_file_size / 1024 / 1024}MB"
        
        # Check if valid image
        try:
            img = Image.open(io.BytesIO(file_content))
            if img.format not in self.allowed_formats:
                return False, f"Invalid format. Allowed formats: {', '.join(self.allowed_formats)}"
            return True, None
        except Exception as e:
            return False, f"Invalid image file: {str(e)}"
    
    def optimize_image(
        self,
        image_bytes: bytes,
        size_name: str = 'original',
        format: str = 'JPEG'
    ) -> bytes:
        """Optimize and resize image"""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            
            # Convert RGBA to RGB for JPEG
            if format == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Strip EXIF data for privacy and size
            img = ImageOps.exif_transpose(img)
            
            # Resize if needed
            target_size = self.sizes.get(size_name)
            if target_size:
                img.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # Save optimized image
            output = io.BytesIO()
            quality = self.quality.get(size_name, 85)
            
            if format == 'WEBP':
                img.save(output, format='WEBP', quality=quality, method=6)
            else:
                img.save(output, format='JPEG', quality=quality, optimize=True)
            
            return output.getvalue()
        
        except Exception as e:
            logger.error(f"Image optimization failed: {e}")
            raise Exception(f"Failed to optimize image: {str(e)}")
    
    def generate_filename(self, original_filename: str, size_name: str = '') -> str:
        """Generate unique filename"""
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        file_hash = hashlib.md5(f"{timestamp}{original_filename}".encode()).hexdigest()[:8]
        
        ext = Path(original_filename).suffix or '.jpg'
        size_suffix = f"_{size_name}" if size_name else ""
        
        return f"{timestamp}_{file_hash}{size_suffix}{ext}"
    
    def save_image_variants(
        self,
        image_bytes: bytes,
        original_filename: str,
        variants: List[str] = None
    ) -> dict:
        """
        Save multiple variants of an image
        Returns dict with URLs for each variant
        """
        if variants is None:
            variants = ['original', 'large', 'medium', 'thumbnail', 'card']
        
        results = {}
        base_filename = Path(original_filename).stem
        
        for size_name in variants:
            try:
                # Optimize image
                optimized = self.optimize_image(image_bytes, size_name)
                
                # Generate filename
                filename = self.generate_filename(f"{base_filename}_{size_name}.jpg")
                filepath = os.path.join(self.upload_dir, filename)
                
                # Save to disk
                with open(filepath, 'wb') as f:
                    f.write(optimized)
                
                # Generate URL (use CDN if available)
                if self.cdn_url:
                    url = f"{self.cdn_url}/{filename}"
                else:
                    url = f"/uploads/{filename}"
                
                results[size_name] = {
                    'url': url,
                    'filename': filename,
                    'size': len(optimized)
                }
                
            except Exception as e:
                logger.error(f"Failed to save {size_name} variant: {e}")
                continue
        
        return results
    
    def create_watermark(
        self,
        image_bytes: bytes,
        watermark_text: str = "YachtVersal"
    ) -> bytes:
        """Add watermark to image (optional feature)"""
        try:
            from PIL import ImageDraw, ImageFont
            
            img = Image.open(io.BytesIO(image_bytes))
            
            # Create watermark layer
            watermark = Image.new('RGBA', img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(watermark)
            
            # Use default font (or load custom font)
            try:
                font = ImageFont.truetype("arial.ttf", 36)
            except:
                font = ImageFont.load_default()
            
            # Calculate position (bottom right)
            text_bbox = draw.textbbox((0, 0), watermark_text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            x = img.width - text_width - 20
            y = img.height - text_height - 20
            
            # Draw watermark with semi-transparent white
            draw.text((x, y), watermark_text, font=font, fill=(255, 255, 255, 128))
            
            # Composite images
            img = img.convert('RGBA')
            img = Image.alpha_composite(img, watermark)
            
            # Convert back to RGB for JPEG
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[-1])
            
            # Save
            output = io.BytesIO()
            rgb_img.save(output, format='JPEG', quality=90)
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Watermark creation failed: {e}")
            return image_bytes  # Return original if watermark fails
    
    def delete_image(self, filename: str) -> bool:
        """Delete image file"""
        try:
            filepath = os.path.join(self.upload_dir, filename)
            if os.path.exists(filepath):
                os.remove(filepath)
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete image {filename}: {e}")
            return False
    
    def delete_image_variants(self, base_filename: str) -> int:
        """Delete all variants of an image"""
        deleted_count = 0
        base_name = Path(base_filename).stem
        
        # Find and delete all related files
        upload_path = Path(self.upload_dir)
        for file in upload_path.glob(f"*{base_name}*"):
            try:
                file.unlink()
                deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to delete {file}: {e}")
        
        return deleted_count
    
    def convert_to_webp(self, image_bytes: bytes, quality: int = 85) -> bytes:
        """Convert image to WebP format for better compression"""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            output = io.BytesIO()
            img.save(output, format='WEBP', quality=quality, method=6)
            return output.getvalue()
        except Exception as e:
            logger.error(f"WebP conversion failed: {e}")
            return image_bytes
    
    async def upload_to_cdn(self, file_content: bytes, filename: str) -> Optional[str]:
        """
        Upload to CDN (Cloudinary, AWS S3, etc.)
        This is a placeholder - implement based on your CDN choice
        """
        # Example for Cloudinary
        if os.getenv("CLOUDINARY_URL"):
            try:
                import cloudinary
                import cloudinary.uploader
                
                result = cloudinary.uploader.upload(
                    file_content,
                    public_id=filename,
                    folder="yachtversal"
                )
                return result.get('secure_url')
            except Exception as e:
                logger.error(f"CDN upload failed: {e}")
                return None
        
        # Example for AWS S3
        elif os.getenv("AWS_S3_BUCKET"):
            try:
                import boto3
                
                s3 = boto3.client('s3')
                bucket = os.getenv("AWS_S3_BUCKET")
                
                s3.put_object(
                    Bucket=bucket,
                    Key=filename,
                    Body=file_content,
                    ContentType='image/jpeg'
                )
                
                return f"https://{bucket}.s3.amazonaws.com/{filename}"
            except Exception as e:
                logger.error(f"S3 upload failed: {e}")
                return None
        
        return None


# ==================== IMAGE UPLOAD ROUTES ====================

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.listing import ListingImage, Listing
from app.models.media import MediaFile

image_router = APIRouter()
image_service = ImageService()


@image_router.post("/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    listing_id: Optional[int] = Form(None),
    create_variants: bool = Form(True),
    add_watermark: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload and process image"""
    
    # Read file content
    content = await file.read()
    
    # Validate image
    is_valid, error = image_service.validate_image(content)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)
    
    # Add watermark if requested
    if add_watermark:
        content = image_service.create_watermark(content)
    
    # Save variants
    if create_variants:
        variants = image_service.save_image_variants(content, file.filename)
    else:
        # Save only original
        filename = image_service.generate_filename(file.filename)
        filepath = os.path.join(image_service.upload_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(content)
        
        variants = {
            'original': {
                'url': f"/uploads/{filename}",
                'filename': filename,
                'size': len(content)
            }
        }
    
    # Create media file record
    media_file = MediaFile(
        owner_id=current_user.id,  # ✓ CORRECT
        uploaded_by_user_id=current_user.id,  # ✓ Add this too
        listing_id=listing_id,
        filename=variants['original']['filename'],
        url=variants['original']['url'],
        thumbnail_url=variants.get('thumbnail', {}).get('url'),
        file_type='image',
        file_size_mb=variants['original']['size'] / (1024 * 1024),  # ✓ Convert to MB
        optimized=True
    )
    
    db.add(media_file)
    
    # If listing_id provided, create ListingImage
    if listing_id:
        listing_image = ListingImage(
            listing_id=listing_id,
            url=variants['medium']['url'],  # Use medium for main display
            thumbnail_url=variants['thumbnail']['url'],
            filename=variants['original']['filename'],
            display_order=0
        )
        db.add(listing_image)
    
    db.commit()
    db.refresh(media_file)
    
    return {
        "success": True,
        "media_id": media_file.id,
        "variants": variants
    }


@image_router.post("/images/bulk-upload")
async def bulk_upload_images(
    files: List[UploadFile] = File(...),
    listing_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple images at once"""
    
    # Verify listing ownership
    listing = db.query(Listing).filter(
        Listing.id == listing_id,
        Listing.user_id == current_user.id
    ).first()
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    results = []
    
    for i, file in enumerate(files):
        try:
            content = await file.read()
            
            # Validate
            is_valid, error = image_service.validate_image(content)
            if not is_valid:
                results.append({"filename": file.filename, "success": False, "error": error})
                continue
            
            # Save variants
            variants = image_service.save_image_variants(content, file.filename)
            
            # Create listing image
            listing_image = ListingImage(
                listing_id=listing_id,
                url=variants['medium']['url'],
                thumbnail_url=variants['thumbnail']['url'],
                filename=variants['original']['filename'],
                display_order=i
            )
            db.add(listing_image)
            
            results.append({
                "filename": file.filename,
                "success": True,
                "url": variants['medium']['url']
            })
            
        except Exception as e:
            logger.error(f"Failed to upload {file.filename}: {e}")
            results.append({"filename": file.filename, "success": False, "error": str(e)})
    
    db.commit()
    
    return {
        "success": True,
        "total": len(files),
        "uploaded": len([r for r in results if r["success"]]),
        "results": results
    }


@image_router.delete("/images/{media_id}")
async def delete_image(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete image and all its variants"""
    
    media = db.query(MediaFile).filter(
        MediaFile.id == media_id,
        MediaFile.owner_id == current_user.id  # ✓ CORRECT
    ).first()

    
    if not media:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete all variants
    deleted = image_service.delete_image_variants(media.filename)
    
    # Delete from database
    db.query(ListingImage).filter(ListingImage.filename == media.filename).delete()
    db.delete(media)
    db.commit()
    
    return {
        "success": True,
        "files_deleted": deleted
    }


@image_router.put("/images/reorder")
async def reorder_images(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder listing images"""
    
    listing_id = data.get("listing_id")
    image_order = data.get("image_order")  # List of image IDs in new order
    
    # Verify ownership
    listing = db.query(Listing).filter(
        Listing.id == listing_id,
        Listing.user_id == current_user.id
    ).first()
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Update display order
    for i, image_id in enumerate(image_order):
        db.query(ListingImage).filter(
            ListingImage.id == image_id,
            ListingImage.listing_id == listing_id
        ).update({"display_order": i})
    
    db.commit()
    
    return {"success": True}


# Singleton instance
image_service_instance = ImageService()
