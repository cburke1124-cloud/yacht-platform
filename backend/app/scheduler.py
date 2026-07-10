from apscheduler.schedulers.background import BackgroundScheduler
from app.api.routes_featured import expire_featured_listings_task
from app.db.session import SessionLocal

# Module-level reference so health checks can inspect it
scheduler: BackgroundScheduler | None = None

def setup_scheduler():
    global scheduler
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

    # Run every 30 minutes - execute any due YachtWorld/IYBA feed jobs.
    # This function (run_due_yachtworld_jobs) already existed fully built in
    # yachtworld_api.py but was never actually wired into the scheduler — feed
    # jobs had schedule_hours/next_run_at fields that nothing ever consumed,
    # so they only ever ran when an admin manually clicked "Run".
    scheduler.add_job(
        func=run_due_yachtworld_jobs_task,
        trigger="interval",
        minutes=30,
    )

    # Weekly audit (Monday 3am) - backfill any listing/charter photo missing
    # alt text. Every image-creation path already sets alt text inline, but
    # this is the safety net for anything that slips through (e.g. an upload
    # path added later that forgets to set it).
    scheduler.add_job(
        func=backfill_missing_alt_text_task,
        trigger="cron",
        day_of_week="mon",
        hour=3,
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


def run_due_yachtworld_jobs_task():
    """Find all enabled YachtworldSyncJobs (YachtWorld/Boats Group and IYBA
    feed_types) whose next_run_at is due and run them."""
    db = SessionLocal()
    try:
        from app.services.yachtworld_api import run_due_yachtworld_jobs
        count = run_due_yachtworld_jobs(db)
        if count:
            print(f"[Scheduler] Ran {count} due YachtWorld/IYBA feed job(s)")
    except Exception as e:
        print(f"[Scheduler] Error running YachtWorld/IYBA feed jobs: {e}")
    finally:
        db.close()


def backfill_missing_alt_text_task():
    """Weekly safety net: find any listing/charter photo missing alt text
    and generate it from the owning listing/charter's own descriptor fields."""
    db = SessionLocal()
    try:
        from app.services.alt_text import backfill_missing_alt_text
        count = backfill_missing_alt_text(db)
        if count:
            print(f"[Scheduler] Backfilled alt text for {count} image(s)")
    except Exception as e:
        print(f"[Scheduler] Error backfilling alt text: {e}")
    finally:
        db.close()
