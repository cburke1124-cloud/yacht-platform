"""Builds blog drafts from the marketing agent's structured articles.

The admin blog editor treats `content_blocks` (a BlockNote document) as the source of truth
and falls back to flattening the plain-text `content` into paragraphs when it is missing. A
draft stored as HTML alone would therefore lose its headings, lists and links the first time a
reviewer opened and saved it. So the agent sends structure, and this module produces all three
representations the blog stores (BlockNote blocks, sanitized HTML, plain text) from that one
source, so they cannot disagree.

Links are limited to the site's own domain: an agent (or a model behind it) can never put an
external link into a draft.
"""
import html as html_lib
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

MAX_BLOCKS = 60
MAX_TEXT = 2000
MAX_BULLETS = 20
MAX_SEGMENTS = 40


class Segment(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    href: Optional[str] = Field(None, max_length=500)


class Heading(BaseModel):
    type: Literal["heading"]
    level: Literal[2, 3] = 2
    text: str = Field(min_length=1, max_length=200)


class Paragraph(BaseModel):
    type: Literal["paragraph"]
    segments: list[Segment] = Field(min_length=1, max_length=MAX_SEGMENTS)


class Bullets(BaseModel):
    type: Literal["bullets"]
    items: list[list[Segment]] = Field(min_length=1, max_length=MAX_BULLETS)

    @field_validator("items")
    @classmethod
    def _items_not_empty(cls, items):
        for item in items:
            if not item or len(item) > MAX_SEGMENTS:
                raise ValueError("each bullet needs between 1 and %d segments" % MAX_SEGMENTS)
        return items


Block = Annotated[Union[Heading, Paragraph, Bullets], Field(discriminator="type")]


def _segments_of(block) -> list[Segment]:
    if isinstance(block, Paragraph):
        return list(block.segments)
    if isinstance(block, Bullets):
        return [seg for item in block.items for seg in item]
    return []


def foreign_links(blocks, site_url: str) -> list[str]:
    """Every href that does not point at the site itself."""
    prefix = site_url.rstrip("/")
    bad = []
    for block in blocks:
        for seg in _segments_of(block):
            if seg.href and not (seg.href == prefix or seg.href.startswith(prefix + "/")):
                bad.append(seg.href)
    return bad


# --- BlockNote document ------------------------------------------------------------------------

def _inline(segments: list[Segment]) -> list[dict]:
    content = []
    for seg in segments:
        text = {"type": "text", "text": seg.text, "styles": {}}
        content.append({"type": "link", "href": seg.href, "content": [text]} if seg.href else text)
    return content


def to_blocknote(blocks) -> list[dict]:
    document = []
    for block in blocks:
        if isinstance(block, Heading):
            document.append({
                "type": "heading",
                "props": {"level": block.level},
                "content": [{"type": "text", "text": block.text, "styles": {}}],
            })
        elif isinstance(block, Paragraph):
            document.append({"type": "paragraph", "content": _inline(block.segments)})
        else:
            for item in block.items:
                document.append({"type": "bulletListItem", "content": _inline(item)})
    return document


# --- HTML + plain text ---------------------------------------------------------------------------

def _inline_html(segments: list[Segment]) -> str:
    parts = []
    for seg in segments:
        text = html_lib.escape(seg.text)
        if seg.href:
            parts.append(f'<a href="{html_lib.escape(seg.href, quote=True)}">{text}</a>')
        else:
            parts.append(text)
    return "".join(parts)


def to_html(blocks) -> str:
    out = []
    for block in blocks:
        if isinstance(block, Heading):
            out.append(f"<h{block.level}>{html_lib.escape(block.text)}</h{block.level}>")
        elif isinstance(block, Paragraph):
            out.append(f"<p>{_inline_html(block.segments)}</p>")
        else:
            items = "".join(f"<li>{_inline_html(item)}</li>" for item in block.items)
            out.append(f"<ul>{items}</ul>")
    return "".join(out)


def to_plain_text(blocks) -> str:
    out = []
    for block in blocks:
        if isinstance(block, Heading):
            out.append(block.text)
        elif isinstance(block, Paragraph):
            out.append("".join(seg.text for seg in block.segments))
        else:
            out.append("\n".join("- " + "".join(seg.text for seg in item) for item in block.items))
    return "\n\n".join(out)
