"""
Vessel catalog seed — curated dataset of major yacht & boat manufacturers.

Run from the backend root:
    python -m app.migrations.seed_vessel_catalog

Safe to re-run: uses upsert-by-name so it won't create duplicates.
Add new makes/models to CATALOG below and re-run to extend the data.

Schema for each entry:
    {
      "name":       str,          # Make display name (exact, properly cased)
      "country":    str,          # Country of origin
      "propulsion": str,          # "power" | "sail" | "both"
      "notes":      str,          # optional, shown in admin
      "models": [
          {
            "name":      str,
            "boat_type": str,     # matches UI boat_type options
            "propulsion": str,
            "length_ft": float,   # nominal LOA
            "min_year":  int,     # first production year (approx)
            "max_year":  int|None # None = still in production
          }, ...
      ]
    }

BOAT_TYPE values (keep consistent with frontend filters):
  Motor Yacht | Mega Yacht | Trawler | Express Cruiser | Sport Fisher
  Center Console | Sailing Yacht | Catamaran | Sloop | Ketch | Schooner
"""

import sys
import os
import re

# Allow running as `python -m app.migrations.seed_vessel_catalog`
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.db.session import SessionLocal
from app.models.catalog import VesselMake, VesselModel


# ─────────────────────────────────────────────────────────────────────────────
# CATALOG DATA
# ─────────────────────────────────────────────────────────────────────────────

CATALOG = [

    # ── LUXURY ITALIAN MOTOR YACHTS ───────────────────────────────────────────
    {
        "name": "Azimut", "country": "Italy", "propulsion": "power",
        "notes": "Largest Italian yacht builder; sport yachts to large motoryachts",
        "models": [
            {"name": "Azimut 40", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 40, "min_year": 2018, "max_year": None},
            {"name": "Azimut 43", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 43, "min_year": 2019, "max_year": None},
            {"name": "Azimut 45", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 45, "min_year": 2015, "max_year": None},
            {"name": "Azimut 50", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 50, "min_year": 2016, "max_year": None},
            {"name": "Azimut 53", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 53, "min_year": 2022, "max_year": None},
            {"name": "Azimut 55", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 55, "min_year": 2014, "max_year": None},
            {"name": "Azimut 60", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 60, "min_year": 2017, "max_year": None},
            {"name": "Azimut 65", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2016, "max_year": None},
            {"name": "Azimut 72", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 72, "min_year": 2018, "max_year": None},
            {"name": "Azimut 77", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 77, "min_year": 2019, "max_year": None},
            {"name": "Azimut 78", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 78, "min_year": 2022, "max_year": None},
            {"name": "Azimut 95", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 95, "min_year": 2020, "max_year": None},
            {"name": "Azimut Grande 25M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 82, "min_year": 2019, "max_year": None},
            {"name": "Azimut Grande 27M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 89, "min_year": 2021, "max_year": None},
            {"name": "Azimut Grande 30M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 98, "min_year": 2022, "max_year": None},
            {"name": "Azimut S6", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 20, "min_year": 2020, "max_year": None},
            {"name": "Azimut S7", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 23, "min_year": 2021, "max_year": None},
        ],
    },
    {
        "name": "Sunseeker", "country": "United Kingdom", "propulsion": "power",
        "notes": "British luxury motor yachts; sport yachts to superyachts",
        "models": [
            {"name": "Sunseeker Predator 50", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 50, "min_year": 2020, "max_year": None},
            {"name": "Sunseeker Predator 55", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 55, "min_year": 2018, "max_year": None},
            {"name": "Sunseeker Predator 57", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 57, "min_year": 2015, "max_year": 2022},
            {"name": "Sunseeker Predator 65", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2016, "max_year": None},
            {"name": "Sunseeker Predator 74", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 74, "min_year": 2019, "max_year": None},
            {"name": "Sunseeker Manhattan 55", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 55, "min_year": 2018, "max_year": None},
            {"name": "Sunseeker Manhattan 65", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2019, "max_year": None},
            {"name": "Sunseeker 74 Sport Yacht", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 74, "min_year": 2017, "max_year": None},
            {"name": "Sunseeker 86 Yacht", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 86, "min_year": 2016, "max_year": None},
            {"name": "Sunseeker 95 Yacht", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 95, "min_year": 2018, "max_year": None},
            {"name": "Sunseeker 116 Yacht", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 116, "min_year": 2020, "max_year": None},
            {"name": "Sunseeker 161 Yacht", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 161, "min_year": 2021, "max_year": None},
        ],
    },
    {
        "name": "Ferretti", "country": "Italy", "propulsion": "power",
        "notes": "Part of Ferretti Group; classic Italian flybridge motor yachts",
        "models": [
            {"name": "Ferretti 450", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 45, "min_year": 2019, "max_year": None},
            {"name": "Ferretti 500", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 50, "min_year": 2018, "max_year": None},
            {"name": "Ferretti 550", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 55, "min_year": 2016, "max_year": None},
            {"name": "Ferretti 580", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 58, "min_year": 2019, "max_year": None},
            {"name": "Ferretti 650", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2017, "max_year": None},
            {"name": "Ferretti 670", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 67, "min_year": 2021, "max_year": None},
            {"name": "Ferretti 720", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 72, "min_year": 2018, "max_year": None},
            {"name": "Ferretti 780", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 78, "min_year": 2019, "max_year": None},
            {"name": "Ferretti 850", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 85, "min_year": 2020, "max_year": None},
            {"name": "Ferretti 920", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 92, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Princess", "country": "United Kingdom", "propulsion": "power",
        "notes": "British builder; flybridge and sport yachts",
        "models": [
            {"name": "Princess V40", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 40, "min_year": 2019, "max_year": None},
            {"name": "Princess V48", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 48, "min_year": 2018, "max_year": None},
            {"name": "Princess V55", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 55, "min_year": 2019, "max_year": None},
            {"name": "Princess V65", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2020, "max_year": None},
            {"name": "Princess V78", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 78, "min_year": 2021, "max_year": None},
            {"name": "Princess Y72", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 72, "min_year": 2019, "max_year": None},
            {"name": "Princess Y85", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 85, "min_year": 2021, "max_year": None},
            {"name": "Princess Y95", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 95, "min_year": 2022, "max_year": None},
            {"name": "Princess F45", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 45, "min_year": 2020, "max_year": None},
            {"name": "Princess F55", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 55, "min_year": 2021, "max_year": None},
            {"name": "Princess S62", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 62, "min_year": 2022, "max_year": None},
            {"name": "Princess X80", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 80, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Pershing", "country": "Italy", "propulsion": "power",
        "notes": "High-performance luxury; part of Ferretti Group",
        "models": [
            {"name": "Pershing 5X", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 54, "min_year": 2019, "max_year": None},
            {"name": "Pershing 6X", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 62, "min_year": 2020, "max_year": None},
            {"name": "Pershing 7X", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 74, "min_year": 2021, "max_year": None},
            {"name": "Pershing 8X", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 82, "min_year": 2022, "max_year": None},
            {"name": "Pershing 9X", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 92, "min_year": 2023, "max_year": None},
            {"name": "Pershing GTX116", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 116, "min_year": 2023, "max_year": None},
        ],
    },
    {
        "name": "Riva", "country": "Italy", "propulsion": "power",
        "notes": "Iconic Italian brand; part of Ferretti Group",
        "models": [
            {"name": "Riva Sportriva 56", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 56, "min_year": 2021, "max_year": None},
            {"name": "Riva Dolceriva", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 33, "min_year": 2019, "max_year": None},
            {"name": "Riva Ribelle 66", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 66, "min_year": 2022, "max_year": None},
            {"name": "Riva El-Iseo", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 27, "min_year": 2017, "max_year": None},
            {"name": "Riva 76 Perseo", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 76, "min_year": 2020, "max_year": None},
            {"name": "Riva 90 Argo", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 90, "min_year": 2021, "max_year": None},
            {"name": "Riva 110 Dolcevita", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 110, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Benetti", "country": "Italy", "propulsion": "power",
        "notes": "One of Italy's oldest superyacht builders; 100ft+",
        "models": [
            {"name": "Benetti Delfino 95", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 95, "min_year": 2020, "max_year": None},
            {"name": "Benetti Oasis 40M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 131, "min_year": 2021, "max_year": None},
            {"name": "Benetti Motopanfilo 37M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 121, "min_year": 2022, "max_year": None},
            {"name": "Benetti B.Yond 37M", "boat_type": "Mega Yacht", "propulsion": "power", "length_ft": 121, "min_year": 2023, "max_year": None},
        ],
    },

    # ── US SPORT & CRUISER BRANDS ─────────────────────────────────────────────
    {
        "name": "Sea Ray", "country": "USA", "propulsion": "power",
        "notes": "Largest US recreational boat brand; part of Brunswick",
        "models": [
            {"name": "Sea Ray SLX 260", "boat_type": "Center Console", "propulsion": "power", "length_ft": 26, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray SLX 280", "boat_type": "Center Console", "propulsion": "power", "length_ft": 28, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray SLX 310", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 31, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray SLX 350", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 35, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray SLX 400", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 40, "min_year": 2019, "max_year": None},
            {"name": "Sea Ray SDX 250", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 25, "min_year": 2020, "max_year": None},
            {"name": "Sea Ray Sundancer 320", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 32, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray Sundancer 350 Coupe", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 35, "min_year": 2018, "max_year": None},
            {"name": "Sea Ray Sundancer 400 Coupe", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 40, "min_year": 2019, "max_year": None},
            {"name": "Sea Ray Sundancer 460", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 46, "min_year": 2021, "max_year": None},
            {"name": "Sea Ray Sundancer 520", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 52, "min_year": 2022, "max_year": None},
            {"name": "Sea Ray L590", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 59, "min_year": 2019, "max_year": None},
            {"name": "Sea Ray L650 Fly", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 65, "min_year": 2020, "max_year": None},
        ],
    },
    {
        "name": "Boston Whaler", "country": "USA", "propulsion": "power",
        "notes": "Unsinkable construction; part of Brunswick",
        "models": [
            {"name": "Boston Whaler 160 Super Sport", "boat_type": "Center Console", "propulsion": "power", "length_ft": 16, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 190 Montauk", "boat_type": "Center Console", "propulsion": "power", "length_ft": 19, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 210 Montauk", "boat_type": "Center Console", "propulsion": "power", "length_ft": 21, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 230 Vantage", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 23, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 270 Dauntless", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 27, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 280 Outrage", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 28, "min_year": 2019, "max_year": None},
            {"name": "Boston Whaler 315 Conquest", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 31.5, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 350 Outrage", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 35, "min_year": 2018, "max_year": None},
            {"name": "Boston Whaler 380 Outrage", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 38, "min_year": 2021, "max_year": None},
            {"name": "Boston Whaler 420 Outrage", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 42, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Grady-White", "country": "USA", "propulsion": "power",
        "notes": "Quality US center consoles and sport fishers",
        "models": [
            {"name": "Grady-White Freedom 205", "boat_type": "Center Console", "propulsion": "power", "length_ft": 20.5, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Freedom 235", "boat_type": "Center Console", "propulsion": "power", "length_ft": 23.5, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Journey 228", "boat_type": "Center Console", "propulsion": "power", "length_ft": 22.8, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Freedom 275", "boat_type": "Center Console", "propulsion": "power", "length_ft": 27.5, "min_year": 2019, "max_year": None},
            {"name": "Grady-White Freedom 285", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 28.5, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Bimini 306", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 30.6, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Express 330", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 33, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Canyon 271", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 27.1, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Canyon 306", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 30.6, "min_year": 2018, "max_year": None},
            {"name": "Grady-White Canyon 336", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 33.6, "min_year": 2019, "max_year": None},
            {"name": "Grady-White Canyon 376", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 37.6, "min_year": 2020, "max_year": None},
        ],
    },
    {
        "name": "Chris-Craft", "country": "USA", "propulsion": "power",
        "notes": "Classic American boat brand; wood and fiberglass mahogany-styled",
        "models": [
            {"name": "Chris-Craft Launch 19", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 19, "min_year": 2018, "max_year": None},
            {"name": "Chris-Craft Launch 25", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 25, "min_year": 2018, "max_year": None},
            {"name": "Chris-Craft Launch 28", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 28, "min_year": 2018, "max_year": None},
            {"name": "Chris-Craft Launch 35", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 35, "min_year": 2019, "max_year": None},
            {"name": "Chris-Craft Catalina 27", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 27, "min_year": 2018, "max_year": None},
            {"name": "Chris-Craft Heritage 35", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 35, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Hatteras", "country": "USA", "propulsion": "power",
        "notes": "American sportfishing and motor yacht builder",
        "models": [
            {"name": "Hatteras GT45X", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 45, "min_year": 2019, "max_year": None},
            {"name": "Hatteras GT54 Express", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 54, "min_year": 2018, "max_year": None},
            {"name": "Hatteras GT59 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 59, "min_year": 2019, "max_year": None},
            {"name": "Hatteras GT65 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 65, "min_year": 2020, "max_year": None},
            {"name": "Hatteras G45 Express", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 45, "min_year": 2018, "max_year": None},
            {"name": "Hatteras G60 Express", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 60, "min_year": 2021, "max_year": None},
            {"name": "Hatteras G70 Convertible", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 70, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Viking Yachts", "country": "USA", "propulsion": "power",
        "notes": "Premier American sportfishing convertibles",
        "models": [
            {"name": "Viking 37 Billfish", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 37, "min_year": 2018, "max_year": None},
            {"name": "Viking 44 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 44, "min_year": 2018, "max_year": None},
            {"name": "Viking 48 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 48, "min_year": 2019, "max_year": None},
            {"name": "Viking 52 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 52, "min_year": 2018, "max_year": None},
            {"name": "Viking 54 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 54, "min_year": 2020, "max_year": None},
            {"name": "Viking 58 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 58, "min_year": 2019, "max_year": None},
            {"name": "Viking 62 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 62, "min_year": 2020, "max_year": None},
            {"name": "Viking 72 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 72, "min_year": 2021, "max_year": None},
            {"name": "Viking 80 Convertible", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 80, "min_year": 2022, "max_year": None},
            {"name": "Viking 90 Convertible", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 90, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Bertram", "country": "USA", "propulsion": "power",
        "notes": "Legendary deep-V sportfisherman designs",
        "models": [
            {"name": "Bertram 35 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 35, "min_year": 1961, "max_year": 2001},
            {"name": "Bertram 39 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 39, "min_year": 2018, "max_year": None},
            {"name": "Bertram 50 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 50, "min_year": 2019, "max_year": None},
            {"name": "Bertram 61 Convertible", "boat_type": "Sport Fisher", "propulsion": "power", "length_ft": 61, "min_year": 2020, "max_year": None},
        ],
    },

    # ── TRAWLERS & LONG-RANGE CRUISERS ────────────────────────────────────────
    {
        "name": "Nordhavn", "country": "USA", "propulsion": "power",
        "notes": "Passage-making trawlers; renowned blue-water capability",
        "models": [
            {"name": "Nordhavn 40", "boat_type": "Trawler", "propulsion": "power", "length_ft": 40, "min_year": 2000, "max_year": None},
            {"name": "Nordhavn 43", "boat_type": "Trawler", "propulsion": "power", "length_ft": 43, "min_year": 1999, "max_year": None},
            {"name": "Nordhavn 47", "boat_type": "Trawler", "propulsion": "power", "length_ft": 47, "min_year": 2000, "max_year": None},
            {"name": "Nordhavn 52", "boat_type": "Trawler", "propulsion": "power", "length_ft": 52, "min_year": 2004, "max_year": None},
            {"name": "Nordhavn 55", "boat_type": "Trawler", "propulsion": "power", "length_ft": 55, "min_year": 2007, "max_year": None},
            {"name": "Nordhavn 60", "boat_type": "Trawler", "propulsion": "power", "length_ft": 60, "min_year": 2010, "max_year": None},
            {"name": "Nordhavn 63", "boat_type": "Trawler", "propulsion": "power", "length_ft": 63, "min_year": 2018, "max_year": None},
            {"name": "Nordhavn 75", "boat_type": "Trawler", "propulsion": "power", "length_ft": 75, "min_year": 2015, "max_year": None},
        ],
    },
    {
        "name": "Selene Yachts", "country": "USA", "propulsion": "power",
        "notes": "Long-range passagemaker trawlers built in Asia",
        "models": [
            {"name": "Selene 36", "boat_type": "Trawler", "propulsion": "power", "length_ft": 36, "min_year": 2003, "max_year": None},
            {"name": "Selene 40", "boat_type": "Trawler", "propulsion": "power", "length_ft": 40, "min_year": 2004, "max_year": None},
            {"name": "Selene 43", "boat_type": "Trawler", "propulsion": "power", "length_ft": 43, "min_year": 2005, "max_year": None},
            {"name": "Selene 48", "boat_type": "Trawler", "propulsion": "power", "length_ft": 48, "min_year": 2007, "max_year": None},
            {"name": "Selene 53", "boat_type": "Trawler", "propulsion": "power", "length_ft": 53, "min_year": 2010, "max_year": None},
            {"name": "Selene 60", "boat_type": "Trawler", "propulsion": "power", "length_ft": 60, "min_year": 2012, "max_year": None},
        ],
    },
    {
        "name": "Grand Banks", "country": "USA", "propulsion": "power",
        "notes": "Classic trawler yachts; long-range cruisers",
        "models": [
            {"name": "Grand Banks 36", "boat_type": "Trawler", "propulsion": "power", "length_ft": 36, "min_year": 1965, "max_year": None},
            {"name": "Grand Banks 42", "boat_type": "Trawler", "propulsion": "power", "length_ft": 42, "min_year": 1975, "max_year": None},
            {"name": "Grand Banks 46", "boat_type": "Trawler", "propulsion": "power", "length_ft": 46, "min_year": 1990, "max_year": None},
            {"name": "Grand Banks 52", "boat_type": "Trawler", "propulsion": "power", "length_ft": 52, "min_year": 2005, "max_year": None},
            {"name": "Grand Banks 60", "boat_type": "Trawler", "propulsion": "power", "length_ft": 60, "min_year": 2016, "max_year": None},
        ],
    },

    # ── SAILING YACHTS — MONOHULL ─────────────────────────────────────────────
    {
        "name": "Beneteau", "country": "France", "propulsion": "both",
        "notes": "World's largest production sailboat builder; also power",
        "models": [
            {"name": "Beneteau Oceanis 30.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 30.1, "min_year": 2020, "max_year": None},
            {"name": "Beneteau Oceanis 34.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 34.1, "min_year": 2021, "max_year": None},
            {"name": "Beneteau Oceanis 38.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 38.1, "min_year": 2018, "max_year": None},
            {"name": "Beneteau Oceanis 40.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 40.1, "min_year": 2019, "max_year": None},
            {"name": "Beneteau Oceanis 46.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 46.1, "min_year": 2020, "max_year": None},
            {"name": "Beneteau Oceanis 51.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 51.1, "min_year": 2019, "max_year": None},
            {"name": "Beneteau Oceanis 55.1", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 55.1, "min_year": 2021, "max_year": None},
            {"name": "Beneteau Oceanis 60", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 60, "min_year": 2016, "max_year": None},
            {"name": "Beneteau First 27", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 27, "min_year": 2020, "max_year": None},
            {"name": "Beneteau First 36", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 36, "min_year": 2019, "max_year": None},
            {"name": "Beneteau First 44", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 44, "min_year": 2021, "max_year": None},
            {"name": "Beneteau Sense 55", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 55, "min_year": 2015, "max_year": 2020},
            {"name": "Beneteau Antares 11", "boat_type": "Motor Yacht", "propulsion": "power", "length_ft": 36, "min_year": 2018, "max_year": None},
        ],
    },
    {
        "name": "Jeanneau", "country": "France", "propulsion": "both",
        "notes": "Major French production builder; part of Beneteau Group",
        "models": [
            {"name": "Jeanneau Sun Odyssey 319", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 31.9, "min_year": 2018, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 349", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 34.9, "min_year": 2018, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 380", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 38, "min_year": 2019, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 410", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 41, "min_year": 2019, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 440", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 44, "min_year": 2020, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 490", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 49, "min_year": 2020, "max_year": None},
            {"name": "Jeanneau Sun Odyssey 519", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 51.9, "min_year": 2016, "max_year": 2022},
            {"name": "Jeanneau Leader 33", "boat_type": "Express Cruiser", "propulsion": "power", "length_ft": 33, "min_year": 2019, "max_year": None},
            {"name": "Jeanneau Cap Camarat 9.0 WA", "boat_type": "Center Console", "propulsion": "power", "length_ft": 29.5, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Bavaria", "country": "Germany", "propulsion": "sail",
        "notes": "German production sailboats; value-focused",
        "models": [
            {"name": "Bavaria C42", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 42, "min_year": 2016, "max_year": None},
            {"name": "Bavaria C45", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 45, "min_year": 2016, "max_year": None},
            {"name": "Bavaria C46", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 46, "min_year": 2020, "max_year": None},
            {"name": "Bavaria C50", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 50, "min_year": 2017, "max_year": None},
            {"name": "Bavaria C57", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 57, "min_year": 2019, "max_year": None},
            {"name": "Bavaria Cruiser 34", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 34, "min_year": 2018, "max_year": None},
            {"name": "Bavaria Cruiser 46", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 46, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Hallberg-Rassy", "country": "Sweden", "propulsion": "sail",
        "notes": "Premium Swedish cruising yachts; renowned quality",
        "models": [
            {"name": "Hallberg-Rassy 31", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 31, "min_year": 2000, "max_year": None},
            {"name": "Hallberg-Rassy 40", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 40, "min_year": 2010, "max_year": None},
            {"name": "Hallberg-Rassy 43", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 43, "min_year": 2018, "max_year": None},
            {"name": "Hallberg-Rassy 44e", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 44, "min_year": 2021, "max_year": None},
            {"name": "Hallberg-Rassy 50", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 50, "min_year": 2019, "max_year": None},
            {"name": "Hallberg-Rassy 57", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 57, "min_year": 2014, "max_year": None},
            {"name": "Hallberg-Rassy 64", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 64, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "X-Yachts", "country": "Denmark", "propulsion": "sail",
        "notes": "Danish performance cruisers; racing heritage",
        "models": [
            {"name": "X-Yachts Xc 35", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 35, "min_year": 2019, "max_year": None},
            {"name": "X-Yachts Xc 38", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 38, "min_year": 2019, "max_year": None},
            {"name": "X-Yachts Xc 42", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 42, "min_year": 2020, "max_year": None},
            {"name": "X-Yachts Xc 45", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 45, "min_year": 2020, "max_year": None},
            {"name": "X-Yachts Xc 50", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 50, "min_year": 2020, "max_year": None},
            {"name": "X-Yachts Xp 44", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 44, "min_year": 2021, "max_year": None},
        ],
    },
    {
        "name": "Oyster Yachts", "country": "United Kingdom", "propulsion": "sail",
        "notes": "British bluewater sailing yachts; premium segment",
        "models": [
            {"name": "Oyster 475", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 47.5, "min_year": 2018, "max_year": None},
            {"name": "Oyster 495", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 49.5, "min_year": 2020, "max_year": None},
            {"name": "Oyster 565", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 56.5, "min_year": 2019, "max_year": None},
            {"name": "Oyster 595", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 59.5, "min_year": 2021, "max_year": None},
            {"name": "Oyster 675", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 67.5, "min_year": 2018, "max_year": None},
            {"name": "Oyster 745", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 74.5, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Hunter Marine", "country": "USA", "propulsion": "sail",
        "notes": "American production cruising sailboats",
        "models": [
            {"name": "Hunter 33", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 33, "min_year": 2005, "max_year": 2015},
            {"name": "Hunter 36", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 36, "min_year": 2005, "max_year": 2016},
            {"name": "Hunter 41 DS", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 41, "min_year": 2007, "max_year": 2015},
            {"name": "Hunter 45 DS", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 45, "min_year": 2007, "max_year": 2016},
            {"name": "Hunter 50", "boat_type": "Sailing Yacht", "propulsion": "sail", "length_ft": 50, "min_year": 2006, "max_year": 2015},
        ],
    },
    {
        "name": "Catalina Yachts", "country": "USA", "propulsion": "sail",
        "notes": "Most popular US cruising sailboat brand by volume",
        "models": [
            {"name": "Catalina 315", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 31.5, "min_year": 2013, "max_year": None},
            {"name": "Catalina 355", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 35.5, "min_year": 2014, "max_year": None},
            {"name": "Catalina 375", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 37.5, "min_year": 2009, "max_year": None},
            {"name": "Catalina 385", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 38.5, "min_year": 2010, "max_year": None},
            {"name": "Catalina 425", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 42.5, "min_year": 2011, "max_year": None},
            {"name": "Catalina 445", "boat_type": "Sloop", "propulsion": "sail", "length_ft": 44.5, "min_year": 2009, "max_year": None},
        ],
    },

    # ── CATAMARANS ────────────────────────────────────────────────────────────
    {
        "name": "Lagoon", "country": "France", "propulsion": "sail",
        "notes": "World's most popular sailing catamaran brand; part of Beneteau Group",
        "models": [
            {"name": "Lagoon 380", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 38, "min_year": 2005, "max_year": 2018},
            {"name": "Lagoon 40", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 40, "min_year": 2018, "max_year": None},
            {"name": "Lagoon 42", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 42, "min_year": 2015, "max_year": None},
            {"name": "Lagoon 46", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 46, "min_year": 2020, "max_year": None},
            {"name": "Lagoon 50", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 50, "min_year": 2017, "max_year": None},
            {"name": "Lagoon 51", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 51, "min_year": 2021, "max_year": None},
            {"name": "Lagoon 55", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 55, "min_year": 2018, "max_year": None},
            {"name": "Lagoon 620", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 62, "min_year": 2014, "max_year": None},
            {"name": "Lagoon 77", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 77, "min_year": 2023, "max_year": None},
        ],
    },
    {
        "name": "Leopard Catamarans", "country": "South Africa", "propulsion": "sail",
        "notes": "Robertson & Caine built; popular charter and private cats",
        "models": [
            {"name": "Leopard 40", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 40, "min_year": 2018, "max_year": None},
            {"name": "Leopard 42", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 42, "min_year": 2015, "max_year": None},
            {"name": "Leopard 45", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 45, "min_year": 2018, "max_year": None},
            {"name": "Leopard 46", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 46, "min_year": 2021, "max_year": None},
            {"name": "Leopard 50", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 50, "min_year": 2019, "max_year": None},
            {"name": "Leopard 53", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 53, "min_year": 2022, "max_year": None},
            {"name": "Leopard 58", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 58, "min_year": 2016, "max_year": None},
        ],
    },
    {
        "name": "Fountaine Pajot", "country": "France", "propulsion": "both",
        "notes": "French catamaran specialist; sail and power cats",
        "models": [
            {"name": "Fountaine Pajot Lucia 40", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 40, "min_year": 2017, "max_year": None},
            {"name": "Fountaine Pajot Elba 45", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 45, "min_year": 2020, "max_year": None},
            {"name": "Fountaine Pajot Aura 51", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 51, "min_year": 2021, "max_year": None},
            {"name": "Fountaine Pajot Alegria 67", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 67, "min_year": 2018, "max_year": None},
            {"name": "Fountaine Pajot Samana 59", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 59, "min_year": 2022, "max_year": None},
            {"name": "Fountaine Pajot MY 37", "boat_type": "Catamaran", "propulsion": "power", "length_ft": 37, "min_year": 2017, "max_year": None},
            {"name": "Fountaine Pajot MY 44", "boat_type": "Catamaran", "propulsion": "power", "length_ft": 44, "min_year": 2019, "max_year": None},
        ],
    },
    {
        "name": "Privilege Marine", "country": "France", "propulsion": "sail",
        "notes": "Premium French sailing catamarans",
        "models": [
            {"name": "Privilege 43", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 43, "min_year": 2015, "max_year": None},
            {"name": "Privilege 510", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 51, "min_year": 2016, "max_year": None},
            {"name": "Privilege 580", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 58, "min_year": 2019, "max_year": None},
            {"name": "Privilege 615", "boat_type": "Catamaran", "propulsion": "sail", "length_ft": 61.5, "min_year": 2022, "max_year": None},
        ],
    },

    # ── CENTER CONSOLES ───────────────────────────────────────────────────────
    {
        "name": "Pursuit Boats", "country": "USA", "propulsion": "power",
        "notes": "Premium US center consoles and offshore boats",
        "models": [
            {"name": "Pursuit S 268 Sport", "boat_type": "Center Console", "propulsion": "power", "length_ft": 26.8, "min_year": 2018, "max_year": None},
            {"name": "Pursuit OS 285 Offshore", "boat_type": "Center Console", "propulsion": "power", "length_ft": 28.5, "min_year": 2018, "max_year": None},
            {"name": "Pursuit DC 325 Dual Console", "boat_type": "Center Console", "propulsion": "power", "length_ft": 32.5, "min_year": 2019, "max_year": None},
            {"name": "Pursuit OS 355 Offshore", "boat_type": "Center Console", "propulsion": "power", "length_ft": 35.5, "min_year": 2019, "max_year": None},
            {"name": "Pursuit OS 385 Offshore", "boat_type": "Center Console", "propulsion": "power", "length_ft": 38.5, "min_year": 2020, "max_year": None},
        ],
    },
    {
        "name": "Scout Boats", "country": "USA", "propulsion": "power",
        "notes": "Quality center consoles from South Carolina",
        "models": [
            {"name": "Scout 215 XSF", "boat_type": "Center Console", "propulsion": "power", "length_ft": 21.5, "min_year": 2019, "max_year": None},
            {"name": "Scout 235 XSF", "boat_type": "Center Console", "propulsion": "power", "length_ft": 23.5, "min_year": 2019, "max_year": None},
            {"name": "Scout 251 XSS", "boat_type": "Center Console", "propulsion": "power", "length_ft": 25.1, "min_year": 2018, "max_year": None},
            {"name": "Scout 280 LXF", "boat_type": "Center Console", "propulsion": "power", "length_ft": 28, "min_year": 2020, "max_year": None},
            {"name": "Scout 320 LXF", "boat_type": "Center Console", "propulsion": "power", "length_ft": 32, "min_year": 2021, "max_year": None},
            {"name": "Scout 350 LXF", "boat_type": "Center Console", "propulsion": "power", "length_ft": 35, "min_year": 2022, "max_year": None},
        ],
    },
    {
        "name": "Mako", "country": "USA", "propulsion": "power",
        "notes": "Offshore fishing center consoles",
        "models": [
            {"name": "Mako 184 CC", "boat_type": "Center Console", "propulsion": "power", "length_ft": 18.4, "min_year": 2018, "max_year": None},
            {"name": "Mako 214 CC", "boat_type": "Center Console", "propulsion": "power", "length_ft": 21.4, "min_year": 2018, "max_year": None},
            {"name": "Mako 234 CC", "boat_type": "Center Console", "propulsion": "power", "length_ft": 23.4, "min_year": 2019, "max_year": None},
            {"name": "Mako 284 CC", "boat_type": "Center Console", "propulsion": "power", "length_ft": 28.4, "min_year": 2019, "max_year": None},
            {"name": "Mako 334 CC", "boat_type": "Center Console", "propulsion": "power", "length_ft": 33.4, "min_year": 2020, "max_year": None},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def seed(db):
    added_makes = 0
    added_models = 0
    skipped = 0

    for entry in CATALOG:
        slug = _slugify(entry["name"])

        # Upsert make
        make = db.query(VesselMake).filter_by(name=entry["name"]).first()
        if not make:
            make = VesselMake(
                name=entry["name"],
                slug=slug,
                country=entry.get("country"),
                propulsion=entry.get("propulsion", "both"),
                notes=entry.get("notes"),
                source="manual",
            )
            db.add(make)
            db.flush()  # get make.id
            added_makes += 1
            print(f"  + Make: {make.name}")
        else:
            # Update fields if changed
            make.country = entry.get("country", make.country)
            make.propulsion = entry.get("propulsion", make.propulsion)

        # Upsert models
        for m in entry.get("models", []):
            existing = (
                db.query(VesselModel)
                .filter_by(make_id=make.id, name=m["name"])
                .first()
            )
            if existing:
                skipped += 1
                continue
            model = VesselModel(
                make_id=make.id,
                name=m["name"],
                boat_type=m.get("boat_type"),
                propulsion=m.get("propulsion"),
                length_ft=m.get("length_ft"),
                min_year=m.get("min_year"),
                max_year=m.get("max_year"),
                source="manual",
            )
            db.add(model)
            added_models += 1

    db.commit()
    print(f"\nDone. Added {added_makes} makes, {added_models} models. Skipped {skipped} existing.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("Seeding vessel catalog...\n")
        seed(db)
    finally:
        db.close()
