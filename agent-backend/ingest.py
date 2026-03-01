"""Placeholder ingest utilities. External extraction is disabled."""

from typing import List


def extract_pdf(file_bytes: bytes, filename: str = "document.pdf") -> str:
    """Return empty string; PDF extraction is not used."""
    return ""


def extract_urls(urls: List[str]) -> List[str]:
    """Return empty list; URL crawling is not used."""
    return []


def truncate(text: str, max_chars: int = 8000) -> str:
    """Simple truncation helper."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[...truncated...]"
