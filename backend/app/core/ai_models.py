"""
Central place for Anthropic model-id constants used across the backend.
Import the named constant here — never hardcode a model string inline.
"""

TEXT_EXTRACTION_MODEL = "claude-haiku-4-5"  # cheap structured-JSON extraction (short NL query -> criteria)
VISION_MODEL = "claude-sonnet-5"  # image/vision calls — unchanged for now
