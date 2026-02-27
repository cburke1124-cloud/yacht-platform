from typing import Dict, List, Optional
from datetime import datetime
from fastapi import Depends
import json


class SEOService:
    """Generate SEO metadata, structured data, and sitemaps"""
    
    @staticmethod
    def generate_listing_metadata(listing: dict, base_url: str) -> Dict:
        """Generate complete SEO metadata for a listing"""
        title = f"{listing.get('year', '')} {listing.get('make', '')} {listing.get('model', '')} - {listing.get('length_feet', '')}ft | YachtVersal"
        
        description = listing.get('description', '')[:160] if listing.get('description') else \
            f"{listing.get('year', '')} {listing.get('make', '')} {listing.get('model', '')} yacht for sale. " \
            f"{listing.get('length_feet', '')} feet. Located in {listing.get('city', '')}, {listing.get('state', '')}. " \
            f"${listing.get('price', 0):,.0f}"
        
        keywords = [
            listing.get('make', ''),
            listing.get('model', ''),
            f"{listing.get('year', '')} yacht",
            f"{listing.get('length_feet', '')}ft yacht",
            listing.get('boat_type', ''),
            f"yacht for sale {listing.get('city', '')}",
            "luxury yacht",
            "yacht marketplace"
        ]
        
        image_url = listing.get('images', [{}])[0].get('url', '') if listing.get('images') else ''
        listing_url = f"{base_url}/listings/{listing.get('id')}"
        
        return {
            "title": title,
            "description": description,
            "keywords": ", ".join(filter(None, keywords)),
            "canonical_url": listing_url,
            "og_tags": {
                "og:title": title,
                "og:description": description,
                "og:image": image_url,
                "og:url": listing_url,
                "og:type": "product",
                "og:site_name": "YachtVersal"
            },
            "twitter_tags": {
                "twitter:card": "summary_large_image",
                "twitter:title": title,
                "twitter:description": description,
                "twitter:image": image_url
            },
            "structured_data": SEOService.generate_product_schema(listing, base_url)
        }
    
    @staticmethod
    def generate_product_schema(listing: dict, base_url: str) -> str:
        """Generate Schema.org Product structured data"""
        schema = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": f"{listing.get('year', '')} {listing.get('make', '')} {listing.get('model', '')}",
            "description": listing.get('description', ''),
            "brand": {
                "@type": "Brand",
                "name": listing.get('make', '')
            },
            "offers": {
                "@type": "Offer",
                "url": f"{base_url}/listings/{listing.get('id')}",
                "priceCurrency": listing.get('currency', 'USD'),
                "price": listing.get('price', 0),
                "availability": "https://schema.org/InStock",
                "itemCondition": f"https://schema.org/{'NewCondition' if listing.get('condition') == 'new' else 'UsedCondition'}"
            }
        }
        
        # Add images
        if listing.get('images'):
            schema["image"] = [img.get('url') for img in listing['images']]
        
        # Add additional properties
        if listing.get('year'):
            schema["productionDate"] = str(listing['year'])
        
        if listing.get('length_feet'):
            schema["additionalProperty"] = [
                {
                    "@type": "PropertyValue",
                    "name": "Length",
                    "value": f"{listing['length_feet']} feet"
                }
            ]
        
        return json.dumps(schema, indent=2)
    
    @staticmethod
    def generate_dealer_schema(dealer: dict, base_url: str) -> str:
        """Generate Schema.org LocalBusiness structured data for dealer"""
        schema = {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": dealer.get('company_name', ''),
            "description": dealer.get('description', ''),
            "url": f"{base_url}/dealers/{dealer.get('slug', '')}",
            "telephone": dealer.get('phone', ''),
            "email": dealer.get('email', ''),
            "address": {
                "@type": "PostalAddress",
                "streetAddress": dealer.get('address', ''),
                "addressLocality": dealer.get('city', ''),
                "addressRegion": dealer.get('state', ''),
                "postalCode": dealer.get('zip_code', ''),
                "addressCountry": dealer.get('country', 'USA')
            }
        }
        
        if dealer.get('logo_url'):
            schema["logo"] = dealer['logo_url']
        
        if dealer.get('website'):
            schema["sameAs"] = [dealer['website']]
        
        return json.dumps(schema, indent=2)
    
    @staticmethod
    def generate_sitemap_xml(listings: List[dict], dealers: List[dict], base_url: str) -> str:
        """Generate XML sitemap"""
        xml = ['<?xml version="1.0" encoding="UTF-8"?>']
        xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        
        # Homepage
        xml.append('  <url>')
        xml.append(f'    <loc>{base_url}/</loc>')
        xml.append(f'    <lastmod>{datetime.utcnow().strftime("%Y-%m-%d")}</lastmod>')
        xml.append('    <changefreq>daily</changefreq>')
        xml.append('    <priority>1.0</priority>')
        xml.append('  </url>')
        
        # Static pages
        static_pages = [
            {'path': '/listings', 'priority': '0.9', 'freq': 'daily'},
            {'path': '/dealers', 'priority': '0.8', 'freq': 'weekly'},
            {'path': '/about', 'priority': '0.5', 'freq': 'monthly'},
            {'path': '/contact', 'priority': '0.5', 'freq': 'monthly'},
        ]
        
        for page in static_pages:
            xml.append('  <url>')
            xml.append(f'    <loc>{base_url}{page["path"]}</loc>')
            xml.append(f'    <changefreq>{page["freq"]}</changefreq>')
            xml.append(f'    <priority>{page["priority"]}</priority>')
            xml.append('  </url>')
        
        # Listings
        for listing in listings:
            if listing.get('status') == 'active':
                xml.append('  <url>')
                xml.append(f'    <loc>{base_url}/listings/{listing["id"]}</loc>')
                
                updated = listing.get('updated_at') or listing.get('created_at')
                if updated:
                    xml.append(f'    <lastmod>{updated[:10]}</lastmod>')
                
                xml.append('    <changefreq>weekly</changefreq>')
                xml.append('    <priority>0.8</priority>')
                xml.append('  </url>')
        
        # Dealers
        for dealer in dealers:
            xml.append('  <url>')
            xml.append(f'    <loc>{base_url}/dealers/{dealer["slug"]}</loc>')
            xml.append('    <changefreq>monthly</changefreq>')
            xml.append('    <priority>0.7</priority>')
            xml.append('  </url>')
        
        xml.append('</urlset>')
        return '\n'.join(xml)
    
    @staticmethod
    def generate_robots_txt(base_url: str) -> str:
        """Generate robots.txt content"""
        return f"""User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard/
Disallow: /api/
Disallow: /settings/

# Sitemaps
Sitemap: {base_url}/sitemap.xml

# Crawl-delay
Crawl-delay: 1
"""
    
    @staticmethod
    def generate_breadcrumb_schema(breadcrumbs: List[Dict], base_url: str) -> str:
        """Generate breadcrumb structured data"""
        items = []
        
        for i, crumb in enumerate(breadcrumbs, 1):
            items.append({
                "@type": "ListItem",
                "position": i,
                "name": crumb["name"],
                "item": f"{base_url}{crumb['url']}"
            })
        
        schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": items
        }
        
        return json.dumps(schema, indent=2)
    
    @staticmethod
    def generate_search_action_schema(base_url: str) -> str:
        """Generate search action schema for Google"""
        schema = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": base_url,
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": f"{base_url}/listings?search={{search_term_string}}"
                },
                "query-input": "required name=search_term_string"
            }
        }
        
        return json.dumps(schema, indent=2)


# ==================== SEO ROUTES ====================

from fastapi import APIRouter, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.listing import Listing
from app.models.dealer import DealerProfile

seo_router = APIRouter()


@seo_router.get("/sitemap.xml")
def get_sitemap(db: Session = Depends(get_db)):
    """Generate and serve sitemap.xml"""
    from app.core.config import settings
    
    # Get active listings
    listings = db.query(Listing).filter(Listing.status == "active").all()
    listings_data = [
        {
            "id": l.id,
            "status": l.status,
            "updated_at": l.updated_at.isoformat() if l.updated_at else None,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in listings
    ]
    
    # Get dealers
    dealers = db.query(DealerProfile).filter(DealerProfile.active == True).all()
    dealers_data = [{"slug": d.slug} for d in dealers]
    
    sitemap_xml = SEOService.generate_sitemap_xml(
        listings=listings_data,
        dealers=dealers_data,
        base_url=settings.BASE_URL
    )
    
    return Response(content=sitemap_xml, media_type="application/xml")


@seo_router.get("/robots.txt")
def get_robots_txt():
    """Serve robots.txt"""
    from app.core.config import settings
    robots = SEOService.generate_robots_txt(settings.BASE_URL)
    return Response(content=robots, media_type="text/plain")


# Singleton instance
seo_service = SEOService()
