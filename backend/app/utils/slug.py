import re
from sqlalchemy.orm import Session


def create_slug(text: str, db: Session, model_class) -> str:
    """Create a unique URL-friendly slug from text"""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    
    # Ensure uniqueness
    original_slug = slug
    counter = 1
    
    while db.query(model_class).filter(model_class.slug == slug).first():
        slug = f"{original_slug}-{counter}"
        counter += 1
    
    return slug
