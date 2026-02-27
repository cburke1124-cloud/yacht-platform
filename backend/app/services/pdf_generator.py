from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
import requests
from PIL import Image as PILImage
import qrcode
import tempfile
import os

from app.core.config import settings


def generate_listing_pdf(listing, dealer, images_urls):
    """
    Generate a professional PDF brochure for a yacht listing.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=0.75*inch, leftMargin=0.75*inch,
                           topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=12,
        spaceBefore=20
    )
    
    # Title
    title = Paragraph(listing.title, title_style)
    elements.append(title)
    
    # Price
    price_text = f"<font size=20 color='#059669'>${listing.price:,.0f} {listing.currency or 'USD'}</font>"
    price = Paragraph(price_text, styles['Normal'])
    elements.append(price)
    elements.append(Spacer(1, 0.3*inch))
    
    # Main Image (if available)
    if images_urls and len(images_urls) > 0:
        try:
            response = requests.get(images_urls[0], timeout=10)
            if response.status_code == 200:
                img_temp = BytesIO(response.content)
                pil_img = PILImage.open(img_temp)
                
                # Resize to fit page
                max_width = 6.5 * inch
                max_height = 4 * inch
                img_width, img_height = pil_img.size
                ratio = min(max_width/img_width, max_height/img_height)
                
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                pil_img.save(temp_file.name, 'JPEG')
                
                img = Image(temp_file.name, width=img_width*ratio, height=img_height*ratio)
                elements.append(img)
                elements.append(Spacer(1, 0.3*inch))
                
                # Clean up temp file
                os.unlink(temp_file.name)
        except Exception as e:
            print(f"Failed to add main image: {e}")
    
    # Specifications Table
    elements.append(Paragraph("Specifications", heading_style))
    
    specs_data = [
        ['Year:', str(listing.year) if listing.year else 'N/A', 
         'Length:', f"{listing.length_feet}'" if listing.length_feet else 'N/A'],
        ['Make:', listing.make or 'N/A', 
         'Beam:', f"{listing.beam_feet}'" if listing.beam_feet else 'N/A'],
        ['Model:', listing.model or 'N/A', 
         'Draft:', f"{listing.draft_feet}'" if listing.draft_feet else 'N/A'],
        ['Condition:', listing.condition.title() if listing.condition else 'N/A', 
         'Hull Material:', listing.hull_material or 'N/A'],
        ['Boat Type:', listing.boat_type or 'N/A', 
         'Engine Hours:', str(listing.engine_hours) if listing.engine_hours else 'N/A'],
    ]
    
    specs_table = Table(specs_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    specs_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb'))
    ]))
    
    elements.append(specs_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Accommodations
    if listing.cabins or listing.berths or listing.heads:
        elements.append(Paragraph("Accommodations", heading_style))
        
        accom_data = []
        if listing.cabins:
            accom_data.append(['Cabins:', str(listing.cabins)])
        if listing.berths:
            accom_data.append(['Berths:', str(listing.berths)])
        if listing.heads:
            accom_data.append(['Heads:', str(listing.heads)])
        
        accom_table = Table(accom_data, colWidths=[2*inch, 4.5*inch])
        accom_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb'))
        ]))
        
        elements.append(accom_table)
        elements.append(Spacer(1, 0.3*inch))
    
    # Description
    if listing.description:
        elements.append(Paragraph("Description", heading_style))
        desc_style = ParagraphStyle(
            'Description',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_LEFT,
            spaceBefore=6,
            spaceAfter=12
        )
        description = Paragraph(listing.description.replace('\n', '<br/>'), desc_style)
        elements.append(description)
        elements.append(Spacer(1, 0.3*inch))
    
    # Location
    if listing.city or listing.state:
        elements.append(Paragraph("Location", heading_style))
        location = f"{listing.city}, {listing.state}" if listing.city and listing.state else (listing.city or listing.state or 'N/A')
        elements.append(Paragraph(location, styles['Normal']))
        elements.append(Spacer(1, 0.3*inch))
    
    # Page break before dealer info
    elements.append(PageBreak())
    
    # Dealer Contact Information
    elements.append(Paragraph("Contact Information", heading_style))
    
    dealer_info = [
        ['Company:', dealer.get('company_name') or dealer.get('name', 'N/A')],
        ['Email:', dealer.get('email', 'N/A')],
        ['Phone:', dealer.get('phone', 'N/A')],
    ]
    
    dealer_table = Table(dealer_info, colWidths=[2*inch, 4.5*inch])
    dealer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb'))
    ]))
    
    elements.append(dealer_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # QR Code
    listing_url = f"{settings.BASE_URL}/listings/{listing.id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(listing_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Save QR code to temp file
    qr_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    qr_img.save(qr_temp.name)
    
    qr_image = Image(qr_temp.name, width=1.5*inch, height=1.5*inch)
    
    qr_data = [[qr_image, Paragraph("Scan to view online<br/>" + listing_url, styles['Normal'])]]
    qr_table = Table(qr_data, colWidths=[2*inch, 4.5*inch])
    qr_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ]))
    
    elements.append(qr_table)
    
    # Clean up QR temp file
    os.unlink(qr_temp.name)
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF data
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data
