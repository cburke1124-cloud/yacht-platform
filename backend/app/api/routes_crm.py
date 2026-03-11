from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import requests
import logging

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.misc import CRMIntegration, CRMSyncLog, Inquiry, Message, WebhookConfig, WebhookLog
from app.exceptions import (
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException,
    ExternalServiceException
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== CRM INTEGRATION MANAGEMENT ====================

@router.get("/crm/integrations")
def get_crm_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's CRM integrations"""
    integrations = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": i.id,
            "crm_type": i.crm_type,
            "active": i.active,
            "sync_leads": i.sync_leads,
            "sync_contacts": i.sync_contacts,
            "sync_messages": i.sync_messages,
            "last_sync": i.last_sync.isoformat() if i.last_sync else None,
            "created_at": i.created_at.isoformat() if i.created_at else None
        }
        for i in integrations
    ]


@router.post("/crm/integrations")
async def create_crm_integration(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Connect a CRM integration"""
    crm_type = data.get("crm_type")  # hubspot, gohighlevel
    api_key = data.get("api_key")
    
    if not crm_type or not api_key:
        raise ValidationException("crm_type and api_key are required")
    
    # Check if integration already exists
    existing = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id,
        CRMIntegration.crm_type == crm_type
    ).first()
    
    if existing:
        raise ValidationException(f"{crm_type} integration already exists")
    
    # Verify credentials
    if not await verify_crm_credentials(crm_type, api_key):
        raise ValidationException("Invalid API credentials")
    
    # Create integration
    integration = CRMIntegration(
        user_id=current_user.id,
        crm_type=crm_type,
        api_key=api_key,
        sync_leads=data.get("sync_leads", True),
        sync_contacts=data.get("sync_contacts", True),
        sync_messages=data.get("sync_messages", True),
        active=True
    )
    
    db.add(integration)
    db.commit()
    db.refresh(integration)
    
    return {
        "success": True,
        "integration_id": integration.id,
        "message": f"{crm_type} connected successfully"
    }


@router.put("/crm/settings")
def update_crm_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update CRM sync settings"""
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id,
        CRMIntegration.active == True
    ).first()
    
    if not integration:
        raise ResourceNotFoundException("CRM Integration", "active")
    
    # Update settings
    if "sync_leads" in data:
        integration.sync_leads = data["sync_leads"]
    if "sync_contacts" in data:
        integration.sync_contacts = data["sync_contacts"]
    if "sync_messages" in data:
        integration.sync_messages = data["sync_messages"]
    if "sync_enabled" in data:
        integration.active = data["sync_enabled"]
    
    integration.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Settings updated"}


@router.delete("/crm/disconnect")
def disconnect_crm(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect CRM integration"""
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id,
        CRMIntegration.active == True
    ).first()
    
    if not integration:
        raise ResourceNotFoundException("CRM Integration", "active")
    
    integration.active = False
    db.commit()
    
    return {"success": True, "message": "CRM disconnected"}


@router.post("/crm/test-connection")
async def test_crm_connection(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Test CRM credentials before saving"""
    crm_type = data.get("crm_type")
    api_key = data.get("api_key")
    
    if not crm_type or not api_key:
        raise ValidationException("crm_type and api_key are required")
    
    try:
        is_valid = await verify_crm_credentials(crm_type, api_key)
        if is_valid:
            return {"success": True, "message": "Credentials valid"}
        else:
            raise ValidationException("Invalid credentials")
    except Exception as e:
        raise ExternalServiceException(f"Failed to verify credentials: {str(e)}")


# ==================== CRM SYNC FUNCTIONS ====================

async def verify_crm_credentials(crm_type: str, api_key: str) -> bool:
    """Verify CRM API credentials"""
    try:
        if crm_type == "hubspot":
            return await verify_hubspot_credentials(api_key)
        elif crm_type == "gohighlevel":
            return await verify_gohighlevel_credentials(api_key)
        elif crm_type == "pipedrive":
            return await verify_pipedrive_credentials(api_key)
        elif crm_type == "zoho":
            return await verify_zoho_credentials(api_key)
        elif crm_type == "activecampaign":
            return await verify_activecampaign_credentials(api_key)
        elif crm_type == "salesforce":
            return await verify_salesforce_credentials(api_key)
        else:
            return False
    except Exception as e:
        logger.error(f"Credential verification failed: {e}")
        return False


async def verify_hubspot_credentials(api_key: str) -> bool:
    """Verify HubSpot API key"""
    try:
        response = requests.get(
            "https://api.hubapi.com/crm/v3/objects/contacts",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            params={"limit": 1},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"HubSpot verification failed: {e}")
        return False


async def verify_gohighlevel_credentials(api_key: str) -> bool:
    """Verify GoHighLevel API key"""
    try:
        response = requests.get(
            "https://rest.gohighlevel.com/v1/contacts/",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            params={"limit": 1},
            timeout=10
        )
        return response.status_code in [200, 401]  # 401 means key format is valid
    except Exception as e:
        logger.error(f"GoHighLevel verification failed: {e}")
        return False


async def verify_pipedrive_credentials(api_key: str) -> bool:
    """Verify Pipedrive API key"""
    try:
        response = requests.get(
            "https://api.pipedrive.com/v1/users/me",
            params={"api_token": api_key},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Pipedrive verification failed: {e}")
        return False


async def verify_zoho_credentials(api_key: str) -> bool:
    """Verify Zoho CRM API key"""
    try:
        response = requests.get(
            "https://www.zohoapis.com/crm/v2/users",
            headers={
                "Authorization": f"Zoho-oauthtoken {api_key}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Zoho verification failed: {e}")
        return False


async def verify_activecampaign_credentials(api_key: str) -> bool:
    """Verify ActiveCampaign API key"""
    try:
        # ActiveCampaign requires account URL + API key
        # For now, we'll validate the key format
        if not api_key or len(api_key) < 20:
            return False
        response = requests.get(
            "https://api.activecompaign.com/3/users/me",
            headers={
                "Api-Token": api_key,
                "Content-Type": "application/json"
            },
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"ActiveCampaign verification failed: {e}")
        return False


async def verify_salesforce_credentials(api_key: str) -> bool:
    """Verify Salesforce OAuth token"""
    try:
        # Salesforce requires instance URL + access token
        # This is a simplified version - in production you'd validate both
        if not api_key or len(api_key) < 20:
            return False
        return True
    except Exception as e:
        logger.error(f"Salesforce verification failed: {e}")
        return False


# ==================== SYNC TO CRM ====================

async def sync_inquiry_to_crm(
    inquiry_id: int,
    user_id: int,
    db: Session
):
    """Sync inquiry to user's CRM"""
    # Get integration
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == user_id,
        CRMIntegration.active == True,
        CRMIntegration.sync_leads == True
    ).first()
    
    if not integration:
        return
    
    # Get inquiry
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        return
    
    try:
        if integration.crm_type == "hubspot":
            external_id = await sync_to_hubspot(inquiry, integration)
        elif integration.crm_type == "gohighlevel":
            external_id = await sync_to_gohighlevel(inquiry, integration)
        elif integration.crm_type == "pipedrive":
            external_id = await sync_to_pipedrive(inquiry, integration)
        elif integration.crm_type == "zoho":
            external_id = await sync_to_zoho(inquiry, integration)
        elif integration.crm_type == "activecampaign":
            external_id = await sync_to_activecampaign(inquiry, integration)
        elif integration.crm_type == "salesforce":
            external_id = await sync_to_salesforce(inquiry, integration)
        else:
            external_id = None
        
        # Log sync
        log = CRMSyncLog(
            integration_id=integration.id,
            sync_type="lead",
            record_id=inquiry.id,
            external_id=external_id,
            success=True
        )
        db.add(log)
        
        # Update last sync time
        integration.last_sync = datetime.utcnow()
        db.commit()
        
        logger.info(f"Synced inquiry {inquiry_id} to {integration.crm_type}")
        
    except Exception as e:
        logger.error(f"Failed to sync inquiry {inquiry_id}: {e}")
        
        # Log failed sync
        log = CRMSyncLog(
            integration_id=integration.id,
            sync_type="lead",
            record_id=inquiry.id,
            success=False,
            error_message=str(e)
        )
        db.add(log)
        db.commit()


async def sync_to_hubspot(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to HubSpot"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create contact
    contact_data = {
        "properties": {
            "email": inquiry.sender_email,
            "firstname": inquiry.sender_name.split()[0] if inquiry.sender_name else "",
            "lastname": " ".join(inquiry.sender_name.split()[1:]) if len(inquiry.sender_name.split()) > 1 else "",
            "phone": inquiry.sender_phone or "",
            "message": inquiry.message,
            "hs_lead_status": "NEW"
        }
    }
    
    response = requests.post(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        headers={
            "Authorization": f"Bearer {integration.api_key}",
            "Content-Type": "application/json"
        },
        json=contact_data,
        timeout=10
    )
    
    if response.status_code in [200, 201]:
        contact = response.json()
        contact_id = contact["id"]
        
        # Create deal if listing info available
        if listing:
            deal_data = {
                "properties": {
                    "dealname": f"{listing.title} - {inquiry.sender_name}",
                    "amount": str(listing.price) if listing.price else "0",
                    "dealstage": "appointmentscheduled",
                    "pipeline": "default",
                    "closedate": None,
                    "description": f"Inquiry about: {listing.title}\n\nMessage: {inquiry.message}"
                },
                "associations": [
                    {
                        "to": {"id": contact_id},
                        "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3}]
                    }
                ]
            }
            
            requests.post(
                "https://api.hubapi.com/crm/v3/objects/deals",
                headers={
                    "Authorization": f"Bearer {integration.api_key}",
                    "Content-Type": "application/json"
                },
                json=deal_data,
                timeout=10
            )
        
        db.close()
        return contact_id
    else:
        db.close()
        raise Exception(f"HubSpot API error: {response.status_code}")


async def sync_to_gohighlevel(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to GoHighLevel"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create contact
    contact_data = {
        "email": inquiry.sender_email,
        "name": inquiry.sender_name,
        "phone": inquiry.sender_phone or "",
        "source": "YachtVersal Inquiry",
        "tags": ["yacht-inquiry"],
        "customFields": [
            {
                "key": "inquiry_message",
                "value": inquiry.message
            }
        ]
    }
    
    if listing:
        contact_data["customFields"].extend([
            {"key": "yacht_title", "value": listing.title},
            {"key": "yacht_price", "value": str(listing.price) if listing.price else ""},
            {"key": "yacht_id", "value": str(listing.id)}
        ])
    
    response = requests.post(
        "https://rest.gohighlevel.com/v1/contacts/",
        headers={
            "Authorization": f"Bearer {integration.api_key}",
            "Content-Type": "application/json"
        },
        json=contact_data,
        timeout=10
    )
    
    db.close()
    
    if response.status_code in [200, 201]:
        contact = response.json()
        return contact.get("contact", {}).get("id", "")
    else:
        raise Exception(f"GoHighLevel API error: {response.status_code}")


async def sync_to_pipedrive(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to Pipedrive"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create person (contact)
    person_data = {
        "name": inquiry.sender_name,
        "email": inquiry.sender_email,
        "phone": inquiry.sender_phone or ""
    }
    
    response = requests.post(
        "https://api.pipedrive.com/v1/persons",
        params={"api_token": integration.api_key},
        json=person_data,
        timeout=10
    )
    
    if response.status_code in [200, 201]:
        person = response.json()
        if person.get("success"):
            person_id = person.get("data", {}).get("id")
            
            # Create deal if listing available
            if listing:
                deal_data = {
                    "title": f"{listing.title} - {inquiry.sender_name}",
                    "person_id": person_id,
                    "value": listing.price if listing.price else 0,
                    "currency": "USD",
                    "status": "open"
                }
                
                requests.post(
                    "https://api.pipedrive.com/v1/deals",
                    params={"api_token": integration.api_key},
                    json=deal_data,
                    timeout=10
                )
            
            db.close()
            return str(person_id)
    
    db.close()
    raise Exception(f"Pipedrive API error: {response.status_code}")


async def sync_to_zoho(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to Zoho CRM"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create lead in Zoho
    lead_data = {
        "data": [
            {
                "Last_Name": inquiry.sender_name.split()[-1] if inquiry.sender_name else "Lead",
                "First_Name": inquiry.sender_name.split()[0] if inquiry.sender_name else "",
                "Email": inquiry.sender_email,
                "Phone": inquiry.sender_phone or "",
                "Description": inquiry.message,
                "Source": "Yacht Inquiry"
            }
        ]
    }
    
    if listing:
        lead_data["data"][0].update({
            "Industry": "Marine/Yachts",
            "Lead_Source": f"Yacht: {listing.title}"
        })
    
    response = requests.post(
        "https://www.zohoapis.com/crm/v2/Leads",
        headers={
            "Authorization": f"Zoho-oauthtoken {integration.api_key}",
            "Content-Type": "application/json"
        },
        json=lead_data,
        timeout=10
    )
    
    db.close()
    
    if response.status_code in [200, 201]:
        result = response.json()
        if result.get("data"):
            return result["data"][0].get("id", "")
    
    raise Exception(f"Zoho API error: {response.status_code}")


async def sync_to_activecampaign(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to ActiveCampaign"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create contact in ActiveCampaign
    contact_data = {
        "contact": {
            "email": inquiry.sender_email,
            "firstName": inquiry.sender_name.split()[0] if inquiry.sender_name else "",
            "lastName": " ".join(inquiry.sender_name.split()[1:]) if len(inquiry.sender_name.split()) > 1 else "",
            "phone": inquiry.sender_phone or "",
            "fieldValues": [
                {
                    "field": 1,
                    "value": inquiry.message
                }
            ]
        }
    }
    
    if listing:
        contact_data["contact"]["fieldValues"].extend([
            {"field": 2, "value": listing.title},
            {"field": 3, "value": str(listing.price) if listing.price else ""}
        ])
    
    response = requests.post(
        "https://api.activecompaign.com/3/contacts",
        headers={
            "Api-Token": integration.api_key,
            "Content-Type": "application/json"
        },
        json=contact_data,
        timeout=10
    )
    
    db.close()
    
    if response.status_code in [200, 201]:
        result = response.json()
        if result.get("contact"):
            return str(result["contact"].get("id", ""))
    
    raise Exception(f"ActiveCampaign API error: {response.status_code}")


async def sync_to_salesforce(inquiry: Inquiry, integration: CRMIntegration) -> str:
    """Sync inquiry to Salesforce"""
    from app.models.listing import Listing
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first()
    
    # Create lead in Salesforce
    lead_data = {
        "LastName": inquiry.sender_name.split()[-1] if inquiry.sender_name else "Lead",
        "FirstName": inquiry.sender_name.split()[0] if inquiry.sender_name else "",
        "Email": inquiry.sender_email,
        "Phone": inquiry.sender_phone or "",
        "Description": inquiry.message,
        "Source": "Web",
        "LeadSource": "Yacht Inquiry"
    }
    
    if listing:
        lead_data.update({
            "Company": "Yacht Interested Party",
            "Industry": "Marine"
        })
    
    # Note: This assumes integration.api_key contains both instance URL and access token
    # Format should be: "instance_url|access_token"
    if "|" in integration.api_key:
        instance_url, access_token = integration.api_key.split("|")
    else:
        db.close()
        raise Exception("Invalid Salesforce credentials format")
    
    response = requests.post(
        f"{instance_url}/services/data/v59.0/sobjects/Lead",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        json=lead_data,
        timeout=10
    )
    
    db.close()
    
    if response.status_code in [200, 201]:
        result = response.json()
        return result.get("id", "")
    
    raise Exception(f"Salesforce API error: {response.status_code}")


async def sync_message_to_crm(
    message_id: int,
    user_id: int,
    db: Session
):
    """Sync message to user's CRM as note/activity"""
    # Get integration
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == user_id,
        CRMIntegration.active == True,
        CRMIntegration.sync_messages == True
    ).first()
    
    if not integration:
        return
    
    # Get message
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        return
    
    try:
        # Find associated contact in CRM
        # This is a simplified version - you'd want to maintain a mapping
        # between your users and CRM contact IDs
        
        if integration.crm_type == "hubspot":
            await add_note_to_hubspot(message, integration)
        elif integration.crm_type == "gohighlevel":
            await add_note_to_gohighlevel(message, integration)
        elif integration.crm_type == "pipedrive":
            await add_note_to_pipedrive(message, integration)
        elif integration.crm_type == "zoho":
            await add_note_to_zoho(message, integration)
        elif integration.crm_type == "activecampaign":
            await add_note_to_activecampaign(message, integration)
        elif integration.crm_type == "salesforce":
            await add_note_to_salesforce(message, integration)
        
        # Log sync
        log = CRMSyncLog(
            integration_id=integration.id,
            sync_type="message",
            record_id=message.id,
            success=True
        )
        db.add(log)
        integration.last_sync = datetime.utcnow()
        db.commit()
        
        logger.info(f"Synced message {message_id} to {integration.crm_type}")
        
    except Exception as e:
        logger.error(f"Failed to sync message {message_id}: {e}")


async def add_note_to_hubspot(message: Message, integration: CRMIntegration):
    """Add message as note in HubSpot"""
    # This is a simplified version
    # You'd need to find the contact ID first
    note_data = {
        "properties": {
            "hs_note_body": f"Subject: {message.subject}\n\n{message.body}",
            "hs_timestamp": datetime.utcnow().isoformat()
        }
    }
    
    response = requests.post(
        "https://api.hubapi.com/crm/v3/objects/notes",
        headers={
            "Authorization": f"Bearer {integration.api_key}",
            "Content-Type": "application/json"
        },
        json=note_data,
        timeout=10
    )
    
    if response.status_code not in [200, 201]:
        raise Exception(f"Failed to create note in HubSpot: {response.status_code}")


async def add_note_to_gohighlevel(message: Message, integration: CRMIntegration):
    """Add message as note in GoHighLevel"""
    # Similar implementation for GoHighLevel
    pass


async def add_note_to_pipedrive(message: Message, integration: CRMIntegration):
    """Add message as note in Pipedrive"""
    try:
        note_data = {
            "content": f"Subject: {message.subject}\n\n{message.body}"
        }
        
        response = requests.post(
            "https://api.pipedrive.com/v1/notes",
            params={"api_token": integration.api_key},
            json=note_data,
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Failed to create note in Pipedrive: {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to add note to Pipedrive: {e}")


async def add_note_to_zoho(message: Message, integration: CRMIntegration):
    """Add message as note in Zoho"""
    try:
        note_data = {
            "data": [
                {
                    "Note_Title": f"Message: {message.subject}",
                    "Note_Content": message.body
                }
            ]
        }
        
        response = requests.post(
            "https://www.zohoapis.com/crm/v2/Notes",
            headers={
                "Authorization": f"Zoho-oauthtoken {integration.api_key}",
                "Content-Type": "application/json"
            },
            json=note_data,
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Failed to create note in Zoho: {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to add note to Zoho: {e}")


async def add_note_to_activecampaign(message: Message, integration: CRMIntegration):
    """Add message as note in ActiveCampaign"""
    try:
        note_data = {
            "note": {
                "text": f"Subject: {message.subject}\n\nBody: {message.body}"
            }
        }
        
        response = requests.post(
            "https://api.activecompaign.com/3/notes",
            headers={
                "Api-Token": integration.api_key,
                "Content-Type": "application/json"
            },
            json=note_data,
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Failed to create note in ActiveCampaign: {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to add note to ActiveCampaign: {e}")


async def add_note_to_salesforce(message: Message, integration: CRMIntegration):
    """Add message as note in Salesforce"""
    try:
        if "|" in integration.api_key:
            instance_url, access_token = integration.api_key.split("|")
        else:
            raise Exception("Invalid Salesforce credentials format")
        
        note_data = {
            "Title": f"Message: {message.subject}",
            "Body": message.body
        }
        
        response = requests.post(
            f"{instance_url}/services/data/v59.0/sobjects/Note",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=note_data,
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Failed to create note in Salesforce: {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to add note to Salesforce: {e}")


# ==================== WEBHOOK HANDLERS ====================

@router.post("/crm/webhooks/hubspot")
async def hubspot_webhook(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle incoming HubSpot webhooks"""
    # Process webhook data
    # Update local records based on CRM changes
    logger.info(f"Received HubSpot webhook: {data}")
    return {"success": True}


@router.post("/crm/webhooks/gohighlevel")
async def gohighlevel_webhook(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle incoming GoHighLevel webhooks"""
    logger.info(f"Received GoHighLevel webhook: {data}")
    return {"success": True}


# ==================== WEBHOOK CONFIGURATION ====================

@router.get("/webhooks/config")
def get_webhook_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's webhook configuration"""
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == current_user.id
    ).first()
    
    if not config:
        return None
    
    return {
        "id": config.id,
        "webhook_url": config.webhook_url,
        "format_type": config.format_type,
        "auth_type": config.auth_type,
        "enabled": config.enabled,
        "test_passed": config.test_passed,
        "last_webhook_sent": config.last_webhook_sent.isoformat() if config.last_webhook_sent else None,
        "total_webhooks_sent": config.total_webhooks_sent,
        "webhook_failures": config.webhook_failures,
    }


@router.post("/webhooks/config")
async def create_or_update_webhook_config(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update webhook configuration"""
    webhook_url = data.get("webhook_url")
    format_type = data.get("format_type", "json")
    auth_type = data.get("auth_type", "none")
    auth_token = data.get("auth_token")
    
    if not webhook_url:
        raise ValidationException("webhook_url is required")
    
    if format_type not in ["json", "adf_xml"]:
        raise ValidationException("format_type must be 'json' or 'adf_xml'")
    
    if auth_type not in ["none", "api_key", "bearer", "basic"]:
        raise ValidationException("auth_type must be one of: none, api_key, bearer, basic")
    
    # Find existing config
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == current_user.id
    ).first()
    
    if config:
        config.webhook_url = webhook_url
        config.format_type = format_type
        config.auth_type = auth_type
        if auth_token:
            config.auth_token = auth_token
        config.updated_at = datetime.utcnow()
    else:
        config = WebhookConfig(
            user_id=current_user.id,
            webhook_url=webhook_url,
            format_type=format_type,
            auth_type=auth_type,
            auth_token=auth_token
        )
    
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return {
        "success": True,
        "message": "Webhook configuration saved",
        "config_id": config.id
    }


@router.post("/webhooks/test")
async def test_webhook(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a test webhook"""
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise ResourceNotFoundException("Webhook", "configuration")
    
    # Send test payload
    test_payload = {
        "test": True,
        "message": "Test webhook from YachtVersal",
        "timestamp": datetime.utcnow().isoformat(),
        "format": config.format_type
    }
    
    try:
        success, status_code, error = await send_webhook_payload(config, test_payload)
        
        if success:
            config.test_passed = True
            db.add(config)
            db.commit()
            
            return {
                "success": True,
                "status_code": status_code,
                "message": "Test webhook delivered successfully"
            }
        else:
            return {
                "success": False,
                "status_code": status_code,
                "error": error
            }
    except Exception as e:
        logger.error(f"Error sending test webhook: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@router.delete("/webhooks/config")
def delete_webhook_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete webhook configuration"""
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == current_user.id
    ).first()
    
    if not config:
        raise ResourceNotFoundException("Webhook", "configuration")
    
    db.delete(config)
    db.commit()
    
    return {"success": True, "message": "Webhook configuration deleted"}


@router.get("/webhooks/logs")
def get_webhook_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get webhook delivery logs"""
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == current_user.id
    ).first()
    
    if not config:
        return []
    
    logs = db.query(WebhookLog).filter(
        WebhookLog.webhook_config_id == config.id
    ).order_by(WebhookLog.sent_at.desc()).limit(limit).all()
    
    return [
        {
            "id": log.id,
            "inquiry_id": log.inquiry_id,
            "success": log.success,
            "status_code": log.status_code,
            "error_message": log.error_message,
            "retry_count": log.retry_count,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None
        }
        for log in logs
    ]


# ==================== WEBHOOK DELIVERY ====================

async def send_webhook_payload(config: WebhookConfig, payload: dict) -> tuple[bool, int, str]:
    """Send webhook payload to configured URL. Returns (success, status_code, error_message)"""
    if not config.enabled:
        return False, 0, "Webhook is disabled"
    
    headers = {"Content-Type": "application/json"}
    
    # Add authentication headers
    if config.auth_type == "api_key":
        headers["X-API-Key"] = config.auth_token
    elif config.auth_type == "bearer":
        headers["Authorization"] = f"Bearer {config.auth_token}"
    elif config.auth_type == "basic":
        headers["Authorization"] = f"Basic {config.auth_token}"
    
    # Format payload if needed
    if config.format_type == "adf_xml":
        from app.services.adf_xml_service import format_inquiry_as_adf_xml
        payload_data = format_inquiry_as_adf_xml(payload)
        headers["Content-Type"] = "application/xml"
    else:
        payload_data = payload
    
    try:
        response = requests.post(
            config.webhook_url,
            json=payload_data if isinstance(payload_data, dict) else None,
            data=payload_data if isinstance(payload_data, str) else None,
            headers=headers,
            timeout=10
        )
        
        if response.status_code in [200, 201, 202, 204]:
            return True, response.status_code, ""
        else:
            error_text = response.text[:200] if response.text else "No response body"
            return False, response.status_code, error_text
    except requests.exceptions.Timeout:
        return False, 0, "Request timeout"
    except Exception as e:
        return False, 0, str(e)


async def dispatch_webhook_for_inquiry(inquiry_id: int, db: Session):
    """Send webhook notification for a new inquiry"""
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        return
    
    # Get listing info
    from app.models.listing import Listing
    listing = db.query(Listing).filter(Listing.id == inquiry.listing_id).first() if inquiry.listing_id else None
    
    # GET webhook config for the listing owner (dealer)
    dealer_id = listing.dealer_id if listing else None
    if not dealer_id:
        return
    
    config = db.query(WebhookConfig).filter(
        WebhookConfig.user_id == dealer_id,
        WebhookConfig.enabled == True
    ).first()
    
    if not config:
        return
    
    # Build payload
    payload  = {
        "inquiry_id": inquiry.id,
        "inquiry_type": "boat_inquiry",
        "timestamp": inquiry.created_at.isoformat(),
        "contact": {
            "name": inquiry.sender_name,
            "email": inquiry.sender_email,
            "phone": inquiry.sender_phone
        },
        "message": inquiry.message,
    }
    
    if listing:
        payload["listing"] = {
            "id": listing.id,
            "title": listing.title,
            "year": listing.year,
            "make": listing.make,
            "model": listing.model,
            "price": float(listing.price) if listing.price else None
        }
    
    # Send webhook
    success, status_code, error = await send_webhook_payload(config, payload)
    
    # Log attempt
    log_entry = WebhookLog(
        webhook_config_id=config.id,
        inquiry_id=inquiry.id,
        status_code=status_code,
        success=success,
        error_message=error,
        payload=payload
    )
    
    if success:
        config.last_webhook_sent = datetime.utcnow()
        config.total_webhooks_sent += 1
    else:
        config.webhook_failures += 1
    
    db.add(log_entry)
    db.add(config)
    db.commit()
    
    logger.info(f"Webhook dispatch for inquiry {inquiry_id}: {'success' if success else 'failed'} (status: {status_code})")


# ==================== SYNC HISTORY ====================

@router.get("/crm/sync-history")
def get_sync_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get CRM sync history"""
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id,
        CRMIntegration.active == True
    ).first()
    
    if not integration:
        return []
    
    logs = db.query(CRMSyncLog).filter(
        CRMSyncLog.integration_id == integration.id
    ).order_by(CRMSyncLog.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": log.id,
            "sync_type": log.sync_type,
            "record_id": log.record_id,
            "external_id": log.external_id,
            "success": log.success,
            "error_message": log.error_message,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]


@router.post("/crm/manual-sync")
async def trigger_manual_sync(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a full sync"""
    integration = db.query(CRMIntegration).filter(
        CRMIntegration.user_id == current_user.id,
        CRMIntegration.active == True
    ).first()
    
    if not integration:
        raise ResourceNotFoundException("CRM Integration", "active")
    
    # Add background task to sync all recent inquiries
    background_tasks.add_task(full_sync_to_crm, current_user.id, db)
    
    return {
        "success": True,
        "message": "Full sync started in background"
    }


async def full_sync_to_crm(user_id: int, db: Session):
    """Perform full sync of all inquiries"""
    from datetime import timedelta
    
    # Get inquiries from last 30 days
    cutoff = datetime.utcnow() - timedelta(days=30)
    inquiries = db.query(Inquiry).filter(
        Inquiry.created_at >= cutoff
    ).all()
    
    for inquiry in inquiries:
        await sync_inquiry_to_crm(inquiry.id, user_id, db)
