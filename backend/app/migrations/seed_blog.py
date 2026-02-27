"""
Blog System Migration Script
Run this to create blog-related tables and seed initial data
"""

from app.db.session import SessionLocal
from app.models.blog import BlogCategory, BlogTag, BlogPost, BlogComment
from datetime import datetime

def seed_blog_categories(db):
    """Create initial blog categories"""
    categories = [
        {
            "name": "Yacht Buying",
            "slug": "yacht-buying",
            "description": "Guides and tips for purchasing your dream yacht",
            "icon": "🛥️",
            "color": "#449DD1",
            "order": 1
        },
        {
            "name": "Maintenance",
            "slug": "maintenance",
            "description": "Keep your yacht in pristine condition",
            "icon": "🔧",
            "color": "#CCAF8B",
            "order": 2
        },
        {
            "name": "Destinations",
            "slug": "destinations",
            "description": "Explore the world's best yachting locations",
            "icon": "🌊",
            "color": "#2E2E2E",
            "order": 3
        },
        {
            "name": "News",
            "slug": "news",
            "description": "Latest updates from the yacht industry",
            "icon": "📰",
            "color": "#449DD1",
            "order": 4
        },
        {
            "name": "Guides",
            "slug": "guides",
            "description": "Comprehensive guides for yacht owners",
            "icon": "📚",
            "color": "#CCAF8B",
            "order": 5
        },
        {
            "name": "Market Insights",
            "slug": "market-insights",
            "description": "Analysis and trends in the yacht market",
            "icon": "📊",
            "color": "#2E2E2E",
            "order": 6
        }
    ]
    
    for cat_data in categories:
        # Check if category already exists
        existing = db.query(BlogCategory).filter(
            BlogCategory.slug == cat_data["slug"]
        ).first()
        
        if not existing:
            category = BlogCategory(**cat_data)
            db.add(category)
            print(f"✓ Created category: {cat_data['name']}")
        else:
            print(f"○ Category already exists: {cat_data['name']}")
    
    db.commit()


def seed_blog_tags(db):
    """Create initial blog tags"""
    tags = [
        {"name": "Motor Yacht", "slug": "motor-yacht"},
        {"name": "Sailing", "slug": "sailing"},
        {"name": "Luxury", "slug": "luxury"},
        {"name": "Maintenance Tips", "slug": "maintenance-tips"},
        {"name": "Market Trends", "slug": "market-trends"},
        {"name": "Buying Guide", "slug": "buying-guide"},
        {"name": "Superyacht", "slug": "superyacht"},
        {"name": "Charter", "slug": "charter"},
        {"name": "Mediterranean", "slug": "mediterranean"},
        {"name": "Caribbean", "slug": "caribbean"},
        {"name": "Technology", "slug": "technology"},
        {"name": "Sustainability", "slug": "sustainability"},
        {"name": "Investment", "slug": "investment"},
        {"name": "First-Time Buyer", "slug": "first-time-buyer"},
        {"name": "Crew", "slug": "crew"},
    ]
    
    for tag_data in tags:
        existing = db.query(BlogTag).filter(
            BlogTag.slug == tag_data["slug"]
        ).first()
        
        if not existing:
            tag = BlogTag(**tag_data)
            db.add(tag)
            print(f"✓ Created tag: {tag_data['name']}")
        else:
            print(f"○ Tag already exists: {tag_data['name']}")
    
    db.commit()


def create_sample_post(db):
    """Create a sample blog post"""
    # Get first admin/editor user
    from app.models.user import User
    admin = db.query(User).filter(
        User.user_type.in_(["admin", "editor"])
    ).first()
    
    if not admin:
        print("⚠ No admin/editor user found. Please create one first.")
        return
    
    # Check if sample post exists
    existing = db.query(BlogPost).filter(
        BlogPost.slug == "welcome-to-yachtversal-blog"
    ).first()
    
    if existing:
        print("○ Sample post already exists")
        return
    
    # Get category
    category = db.query(BlogCategory).filter(
        BlogCategory.slug == "news"
    ).first()
    
    post = BlogPost(
        title="Welcome to YachtVersal Blog",
        slug="welcome-to-yachtversal-blog",
        excerpt="Discover expert insights, guides, and stories from the world of luxury yachting. Your journey to yacht ownership starts here.",
        content="""Welcome to the YachtVersal Blog, your premier destination for everything related to luxury yachting!

Whether you're a seasoned yacht owner, considering your first purchase, or simply passionate about the maritime lifestyle, our blog is designed to inform, inspire, and guide you through the fascinating world of yachts.

## What You'll Find Here

Our blog covers a comprehensive range of topics:

**Yacht Buying Guides**: Navigate the complex process of purchasing a yacht with confidence. From understanding different yacht types to negotiating the best deal, we've got you covered.

**Maintenance & Care**: Learn how to keep your vessel in pristine condition with expert maintenance tips, seasonal care guides, and troubleshooting advice.

**Dream Destinations**: Explore the world's most stunning yachting locations, from the Mediterranean's azure waters to the Caribbean's tropical paradises.

**Market Insights**: Stay informed about industry trends, market valuations, and investment opportunities in the yacht market.

**Technology & Innovation**: Discover the latest advancements in yacht design, navigation systems, and eco-friendly technologies.

## Written by Experts

Our content is created by experienced maritime professionals, yacht brokers, and passionate enthusiasts who bring decades of combined experience to every article. We're committed to providing accurate, practical, and engaging content that helps you make informed decisions.

## Join Our Community

We believe in building a community of yacht enthusiasts who share knowledge, experiences, and passion for the maritime lifestyle. Subscribe to our newsletter to receive weekly insights, exclusive content, and updates on the latest yacht listings.

Thank you for joining us on this journey. Whether you're here to learn, explore, or dream, we're excited to have you aboard!

Fair winds and following seas,
The YachtVersal Team""",
        author_id=admin.id,
        category_id=category.id if category else None,
        status="published",
        published_at=datetime.utcnow(),
        reading_time_minutes=3,
        view_count=247,
        featured=True,
        allow_comments=True,
        meta_title="Welcome to YachtVersal Blog - Your Yacht Industry Resource",
        meta_description="Discover expert insights, guides, and stories from the world of luxury yachting.",
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    # Add tags to sample post
    from app.models.blog import BlogPostTag
    tag_slugs = ["luxury", "buying-guide", "first-time-buyer"]
    
    for tag_slug in tag_slugs:
        tag = db.query(BlogTag).filter(BlogTag.slug == tag_slug).first()
        if tag:
            post_tag = BlogPostTag(post_id=post.id, tag_id=tag.id)
            db.add(post_tag)
    
    db.commit()
    print(f"✓ Created sample post: {post.title}")


def run_migration():
    """Run the complete blog migration"""
    print("=" * 60)
    print("YachtVersal Blog System Migration")
    print("=" * 60)
    print()
    
    db = SessionLocal()
    
    try:
        print("Step 1: Creating blog categories...")
        seed_blog_categories(db)
        print()
        
        print("Step 2: Creating blog tags...")
        seed_blog_tags(db)
        print()
        
        print("Step 3: Creating sample blog post...")
        create_sample_post(db)
        print()
        
        print("=" * 60)
        print("✅ Blog migration completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Visit http://localhost:3000/blog to see your blog")
        print("2. Create new posts via the API or admin panel")
        print("3. Customize categories and tags as needed")
        
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()