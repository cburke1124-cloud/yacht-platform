from apscheduler.schedulers.background import BackgroundScheduler
from app.api.routes_featured import expire_featured_listings_task
from app.db.session import SessionLocal

def setup_scheduler():
    scheduler = BackgroundScheduler()
    
    # Run every hour - expire featured listings
    scheduler.add_job(
        func=check_and_expire_featured,
        trigger="interval",
        hours=1
    )
    
    # Run every 15 minutes - publish scheduled blog posts
    scheduler.add_job(
        func=publish_scheduled_blog_posts,
        trigger="interval",
        minutes=15
    )

    # Run every 30 minutes - execute any due scraper jobs
    scheduler.add_job(
        func=run_due_scraper_jobs_task,
        trigger="interval",
        minutes=30,
    )
    
    scheduler.start()

def check_and_expire_featured():
    db = SessionLocal()
    try:
        expire_featured_listings_task(db)
    finally:
        db.close()

def publish_scheduled_blog_posts():
    """Auto-publish scheduled blog posts"""
    db = SessionLocal()
    try:
        from app.models.blog import BlogPost, PostStatus
        from sqlalchemy import and_
        from datetime import datetime
        
        now = datetime.utcnow()
        
        # Find all scheduled posts where scheduled_for is in the past
        scheduled_posts = db.query(BlogPost).filter(
            and_(
                BlogPost.status == PostStatus.SCHEDULED,
                BlogPost.scheduled_for <= now,
                BlogPost.deleted_at == None
            )
        ).all()
        
        # Publish them
        for post in scheduled_posts:
            post.status = PostStatus.PUBLISHED
            post.published_at = post.scheduled_for
        
        db.commit()
        
        if len(scheduled_posts) > 0:
            print(f"Auto-published {len(scheduled_posts)} scheduled post(s)")
            
    except Exception as e:
        print(f"Error publishing scheduled posts: {e}")
        db.rollback()
    finally:
        db.close()


def run_due_scraper_jobs_task():
    """Find all enabled ScraperJobs whose next_run_at is due and run them."""
    db = SessionLocal()
    try:
        from app.services.scraper import run_due_scraper_jobs
        count = run_due_scraper_jobs(db)
        if count:
            print(f"[Scheduler] Ran {count} due scraper job(s)")
    except Exception as e:
        print(f"[Scheduler] Error running scraper jobs: {e}")
    finally:
        db.close()
