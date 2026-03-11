"""
ADF XML formatting service for DMS/CRM integration
ADF (Auto Data Feed) is the automotive industry standard XML format for vehicle data
Adapted here for marine vessels
"""
from datetime import datetime
from typing import Optional, Dict, Any
import xml.etree.ElementTree as ET
from xml.dom import minidom


def format_inquiry_as_adf_xml(payload: Dict[str, Any]) -> str:
    """
    Convert inquiry payload to ADF XML format.
    
    Args:
        payload: Dict containing inquiry and listing data
        
    Returns:
        XML string formatted as ADF
    """
    # Create root element
    adf = ET.Element("adf")
    prospect = ET.SubElement(adf, "prospect")
    
    # Request type
    request = ET.SubElement(prospect, "request")
    request.set("type", "leadstatus")
    
    qualifier = ET.SubElement(request, "qualifier")
    qualifier.set("name", "new")
    
    # Contact information
    contact = ET.SubElement(prospect, "contact")
    contact.set("type", "lead")
    
    # Name
    name_elem = ET.SubElement(contact, "name")
    name_elem.set("part", "full")
    name_elem.text = payload.get("contact", {}).get("name", "Unknown")
    
    # Email
    email = ET.SubElement(contact, "email")
    email.text = payload.get("contact", {}).get("email", "")
    email.set("preferredcontact", "true")
    
    # Phone
    phone = ET.SubElement(contact, "phone")
    phone_num = payload.get("contact", {}).get("phone", "")
    if phone_num:
        phone.text = phone_num
    
    # Vehicle/Vessel information
    if "listing" in payload and payload["listing"]:
        listing = payload["listing"]
        vehicle = ET.SubElement(prospect, "vehicle")
        vehicle.set("interest", "buy")
        vehicle.set("status", "active")
        
        # Year, make, model
        year_elem = ET.SubElement(vehicle, "year")
        year_elem.text = str(listing.get("year", ""))
        
        make_elem = ET.SubElement(vehicle, "make")
        make_elem.text = listing.get("make", "")
        
        model_elem = ET.SubElement(vehicle, "model")
        model_elem.text = listing.get("model", "")
        
        # Vessel type (for boats)
        notes = ET.SubElement(vehicle, "notes")
        notes.text = listing.get("title", "")
        
        # Price
        price = listing.get("price")
        if price:
            price_elem = ET.SubElement(vehicle, "price")
            price_elem.set("type", "asking")
            price_elem.text = str(price)
        
        # VIN equivalent (using listing ID as reference)
        vin = ET.SubElement(vehicle, "vin")
        vin.text = f"YACHT-{listing.get('id', '')}"
    
    # Comments/Message
    comments = ET.SubElement(prospect, "comments")
    message = ET.SubElement(comments, "message")
    message.text = payload.get("message", "")
    
    # Timestamp
    datetime_elem = ET.SubElement(prospect, "datetime")
    datetime_elem.text = payload.get("timestamp", datetime.utcnow().isoformat())
    
    # Pretty print XML
    xml_str = minidom.parseString(ET.tostring(adf)).toprettyxml(indent="  ")
    
    # Remove XML declaration and extra blank lines
    xml_lines = xml_str.split('\n')
    xml_lines = [line for line in xml_lines if line.strip()]
    xml_str = '\n'.join(xml_lines)
    
    # Skip the declaration line if it exists
    if xml_str.startswith("<?xml"):
        xml_str = '\n'.join(xml_str.split('\n')[1:])
    
    return xml_str.strip()


def build_adf_from_inquiry_model(inquiry, listing=None) -> str:
    """
    Build ADF XML directly from database models.
    
    Args:
        inquiry: Inquiry model instance
        listing: Optional Listing model instance
        
    Returns:
        XML string formatted as ADF
    """
    payload = {
        "inquiry_id": inquiry.id,
        "timestamp": inquiry.created_at.isoformat(),
        "contact": {
            "name": inquiry.sender_name,
            "email": inquiry.sender_email,
            "phone": inquiry.sender_phone or ""
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
    
    return format_inquiry_as_adf_xml(payload)


# Example ADF XML output:
"""
<adf>
  <prospect>
    <request type="leadstatus">
      <qualifier name="new"/>
    </request>
    <contact type="lead">
      <name part="full">John Doe</name>
      <email preferredcontact="true">john@example.com</email>
      <phone>555-1234</phone>
    </contact>
    <vehicle interest="buy" status="active">
      <year>2023</year>
      <make>Sea Ray</make>
      <model>Sundancer 350</model>
      <notes>2023 Sea Ray Sundancer 350 - Luxury Motor Yacht</notes>
      <price type="asking">850000</price>
      <vin>YACHT-12345</vin>
    </vehicle>
    <comments>
      <message>I'm interested in this yacht for weekend trips</message>
    </comments>
    <datetime>2026-03-11T15:30:00.123456</datetime>
  </prospect>
</adf>
"""
