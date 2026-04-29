"""
AI Pipeline Service
Core intelligence: image → metadata extraction

Free AI provider (primary):
- Google Gemini 2.5 Flash (free via Google AI Studio key)
- Fallback: Gemini 1.5 Flash

Get your FREE key at: https://aistudio.google.com/app/apikey
Set GEMINI_API_KEY=your_key in your .env file
"""

import httpx
import json
import base64
import re
from typing import Optional, Dict, Any
from config import settings

AI_PROMPT = """You are an expert library assistant specializing in book identification from images.

Analyze this book cover/spine image and extract all visible information.

Return ONLY a JSON object with exactly this structure (no markdown, no explanation, no code fences):
{
  "title": "exact title as printed" or null,
  "subtitle": "subtitle if present" or null,
  "authors": ["Author Name"] or [],
  "publisher": "Publisher Name" or null,
  "isbn_candidates": ["ISBN numbers if visible"] or [],
  "edition": "e.g. 2nd Edition" or null,
  "publication_year": "YYYY" or null,
  "language": "English" or null,
  "series": "Series name if part of a series" or null,
  "visible_text": ["other text visible on cover"],
  "confidence": 0.0 to 1.0,
  "uncertain_fields": ["field names you are unsure about"]
}

CRITICAL RULES:
- Return ONLY the JSON object, nothing else, no markdown backticks
- If a field is not clearly visible, use null
- Do NOT invent or guess publisher, year, or ISBN
- Do NOT hallucinate author biographies
- confidence: Rate 0.9+ if title/author clearly readable and complete, 0.7-0.9 if partially visible but identifiable, 0.5-0.7 if some text readable but unclear, below 0.5 if very unclear or no text visible
- Be generous with confidence if key elements (title/author) are clearly visible
"""


async def extract_with_gemini_free(image_base64: str, media_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Extract book metadata using Google Gemini 2.5 Flash (FREE).
    Get your key at: https://aistudio.google.com/app/apikey
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY not set. Get a FREE key at https://aistudio.google.com/app/apikey "
            "and add GEMINI_API_KEY=your_key to your .env file. "
            "Alternatively set VISION_PROVIDER=anthropic or openai with their respective keys."
        )

    print(f"🔑 GEMINI_API_KEY provided: {bool(api_key)}, length: {len(api_key) if api_key else 0}")

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Convert base64 to bytes
        image_bytes = base64.b64decode(image_base64)
        
        # Determine MIME type from media_type parameter
        mime_type_map = {
            "image/jpeg": "image/jpeg",
            "image/png": "image/png",
            "image/gif": "image/gif",
            "image/webp": "image/webp"
        }
        mime_type = mime_type_map.get(media_type, "image/jpeg")
        
        # Use gemini-2.5-flash model
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        print(f"🤖 Using model: gemini-2.5-flash")
        
        # Send request with image
        response = model.generate_content(
            [
                {"mime_type": mime_type, "data": image_bytes},
                AI_PROMPT
            ],
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=1000
            )
        )
        
        print(f"📡 Gemini API response received")
        
        raw_text = response.text.strip()
        print(f"📝 Raw response preview: {raw_text[:200]}...")
        
        # Clean markdown fences if present
        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text).strip()
        
        # Try to find valid JSON in the response
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            raw_text = json_match.group(0)
        
        print(f"🔍 Cleaned JSON preview: {raw_text[:200]}...")
        
        # Parse JSON with error recovery
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse error: {e}. Attempting to fix...")
            # If JSON is incomplete, try to close it
            if raw_text.count('{') > raw_text.count('}'):
                raw_text += '}' * (raw_text.count('{') - raw_text.count('}'))
            try:
                result = json.loads(raw_text)
            except json.JSONDecodeError:
                # If still failing, try to extract fields using regex
                print("⚠️ JSON parsing failed, trying to extract fields manually...")
                result = {
                    "title": _extract_field(raw_text, "title"),
                    "subtitle": _extract_field(raw_text, "subtitle"),
                    "authors": _extract_array_field(raw_text, "authors"),
                    "publisher": _extract_field(raw_text, "publisher"),
                    "isbn_candidates": _extract_array_field(raw_text, "isbn_candidates"),
                    "edition": _extract_field(raw_text, "edition"),
                    "publication_year": _extract_field(raw_text, "publication_year"),
                    "language": _extract_field(raw_text, "language"),
                    "series": _extract_field(raw_text, "series"),
                    "visible_text": _extract_array_field(raw_text, "visible_text"),
                    "confidence": _extract_number(raw_text, "confidence") or 0.5,
                    "uncertain_fields": _extract_array_field(raw_text, "uncertain_fields")
                }
        
        print(f"✅ Gemini OK, confidence={result.get('confidence', '?')}")
        return result
        
    except Exception as e:
        raise Exception(f"Gemini API error: {e}")


def _extract_field(text: str, field_name: str) -> Optional[str]:
    """Extract a string field from JSON text using regex."""
    pattern = rf'"{field_name}":\s*"([^"\\]*(?:\\.[^"\\]*)*)"'
    match = re.search(pattern, text)
    return match.group(1) if match else None


def _extract_array_field(text: str, field_name: str) -> list:
    """Extract an array field from JSON text using regex."""
    pattern = rf'"{field_name}":\s*\[(.*?)\]'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return []
    array_content = match.group(1)
    # Simple extraction of quoted strings
    items = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', array_content)
    return items if items else []


def _extract_number(text: str, field_name: str) -> Optional[float]:
    """Extract a number field from JSON text using regex."""
    pattern = rf'"{field_name}":\s*([\d.]+)'
    match = re.search(pattern, text)
    try:
        return float(match.group(1)) if match else None
    except (ValueError, AttributeError):
        return None


async def _extract_with_anthropic(image_base64: str, media_type: str) -> Dict[str, Any]:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
                {"type": "text", "text": AI_PROMPT}
            ]}]
        )
        raw = re.sub(r'^```(?:json)?\s*', '', message.content[0].text.strip())
        raw = re.sub(r'\s*```$', '', raw).strip()
        return json.loads(raw)
    except Exception as e:
        raise Exception(f"Anthropic error: {e}")


async def _extract_with_openai(image_base64: str, media_type: str) -> Dict[str, Any]:
    try:
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini", max_tokens=1000, temperature=0.1,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": AI_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_base64}"}}
            ]}]
        )
        raw = re.sub(r'^```(?:json)?\s*', '', response.choices[0].message.content.strip())
        raw = re.sub(r'\s*```$', '', raw).strip()
        return json.loads(raw)
    except Exception as e:
        raise Exception(f"OpenAI error: {e}")


async def _extract_with_ollama(image_base64: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={"model": "llava", "prompt": AI_PROMPT, "images": [image_base64], "stream": False}
            )
        raw = re.sub(r'^```(?:json)?\s*', '', response.json().get("response", "").strip())
        raw = re.sub(r'\s*```$', '', raw).strip()
        return json.loads(raw)
    except Exception as e:
        raise Exception(f"Ollama error: {e}")


async def extract_with_vision(image_base64: str, media_type: str = "image/jpeg") -> Dict[str, Any]:
    """Main dispatch: Use selected provider, no fallback."""
    provider = settings.VISION_PROVIDER.lower()
    
    print(f"🔍 Using vision provider: {provider}")
    
    if provider == "anthropic":
        print("📌 Selected: Anthropic")
        return await _extract_with_anthropic(image_base64, media_type)
    elif provider == "openai":
        print("📌 Selected: OpenAI")
        return await _extract_with_openai(image_base64, media_type)
    elif provider == "ollama":
        print("📌 Selected: Ollama")
        return await _extract_with_ollama(image_base64)
    else:  # Default to Gemini (free)
        print("📌 Selected: Gemini (Free)")
        return await extract_with_gemini_free(image_base64, media_type)


async def lookup_google_books(
    isbn: Optional[str] = None, title: Optional[str] = None, author: Optional[str] = None
) -> Optional[Dict]:
    if not isbn and not title:
        return None
    try:
        if isbn:
            query = f"isbn:{isbn}"
        elif title and author:
            query = f'intitle:"{title}" inauthor:"{author}"'
        else:
            query = f'intitle:"{title}"'

        params = {"q": query, "maxResults": 1}
        if settings.GOOGLE_BOOKS_API_KEY:
            params["key"] = settings.GOOGLE_BOOKS_API_KEY

        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get("https://www.googleapis.com/books/v1/volumes", params=params)
            data = resp.json()

        if data.get("totalItems", 0) == 0:
            return None

        info = data["items"][0].get("volumeInfo", {})
        isbn_10, isbn_13 = None, None
        for ident in info.get("industryIdentifiers", []):
            if ident["type"] == "ISBN_10":
                isbn_10 = ident["identifier"]
            elif ident["type"] == "ISBN_13":
                isbn_13 = ident["identifier"]

        return {
            "title": info.get("title"),
            "subtitle": info.get("subtitle"),
            "authors": info.get("authors", []),
            "publisher": info.get("publisher"),
            "publication_date": info.get("publishedDate"),
            "page_count": info.get("pageCount"),
            "categories": info.get("categories", []),
            "language": info.get("language"),
            "description": info.get("description", "")[:1000],
            "isbn_10": isbn_10,
            "isbn_13": isbn_13,
            "average_rating": info.get("averageRating"),
            "ratings_count": info.get("ratingsCount", 0),
            "thumbnail": info.get("imageLinks", {}).get("thumbnail"),
            "source": "google_books"
        }
    except Exception as e:
        print(f"Google Books API error: {e}")
        return None


async def lookup_open_library(isbn: Optional[str] = None, title: Optional[str] = None) -> Optional[Dict]:
    try:
        if isbn:
            async with httpx.AsyncClient(timeout=10.0) as http:
                resp = await http.get(f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data")
                data = resp.json()
            book = data.get(f"ISBN:{isbn}")
            if not book:
                return None
            return {
                "title": book.get("title"),
                "authors": [a.get("name") for a in book.get("authors", [])],
                "publisher": ([p.get("name") for p in book.get("publishers", [])] or [None])[0],
                "publication_date": book.get("publish_date"),
                "categories": [s.get("name") for s in book.get("subjects", [])][:5],
                "source": "open_library"
            }
        elif title:
            async with httpx.AsyncClient(timeout=10.0) as http:
                resp = await http.get("https://openlibrary.org/search.json", params={
                    "title": title, "limit": 1,
                    "fields": "title,author_name,publisher,first_publish_year,isbn,subject,language,number_of_pages_median"
                })
                data = resp.json()
            if not data.get("docs"):
                return None
            doc = data["docs"][0]
            return {
                "title": doc.get("title"),
                "authors": doc.get("author_name", []),
                "publisher": (doc.get("publisher") or [None])[0],
                "publication_date": str(doc["first_publish_year"]) if doc.get("first_publish_year") else None,
                "isbn_13": (doc.get("isbn") or [None])[0],
                "categories": doc.get("subject", [])[:5],
                "language": (doc.get("language") or [None])[0],
                "page_count": doc.get("number_of_pages_median"),
                "source": "open_library"
            }
    except Exception as e:
        print(f"Open Library API error: {e}")
    return None


async def get_author_details(author_name: str) -> Optional[Dict]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            resp = await http.get(
                "https://openlibrary.org/search/authors.json",
                params={"q": author_name, "limit": 1}
            )
            data = resp.json()
        if not data.get("docs"):
            return None
        doc = data["docs"][0]
        return {
            "name": doc.get("name"),
            "birth_date": doc.get("birth_date"),
            "top_subjects": doc.get("top_subjects", [])[:5],
            "work_count": doc.get("work_count", 0),
        }
    except Exception:
        return None


def calculate_demand_score(google_data: Optional[Dict], ai_data: Optional[Dict] = None) -> Dict[str, Any]:
    if not google_data:
        # Fallback scoring based on AI data and heuristics
        score = 35  # Base score higher than the old 30
        factors = ["AI-only analysis (no Google Books data)"]
        based_on = "AI extraction and category heuristics"

        # Boost score based on AI confidence
        if ai_data and ai_data.get("confidence", 0) >= 0.8:
            score += 15
            factors.append("High AI confidence in extraction")
        elif ai_data and ai_data.get("confidence", 0) >= 0.6:
            score += 10
            factors.append("Moderate AI confidence")

        # Author recognition (basic heuristics)
        authors = ai_data.get("authors", []) if ai_data else []
        famous_authors = [
            "stephen king", "j.k. rowling", "dan brown", "agatha christie",
            "george orwell", "ernest hemingway", "mark twain", "charles dickens",
            "donald trump", "barack obama", "oprah", "elon musk"
        ]

        for author in authors:
            author_lower = author.lower()
            for famous in famous_authors:
                if famous in author_lower:
                    score += 20
                    factors.append(f"Famous author: {author}")
                    break

        score = min(score, 85)  # Cap at 85 without Google Books data
        label = "High" if score >= 70 else ("Medium" if score >= 50 else "Low")
        return {"score": round(score), "label": label, "factors": factors, "based_on": based_on}

    score = 30
    factors = []
    rating = google_data.get("average_rating", 0) or 0
    ratings_count = google_data.get("ratings_count", 0) or 0

    if rating >= 4.5:
        score += 30; factors.append(f"Excellent rating: {rating}/5")
    elif rating >= 4.0:
        score += 20; factors.append(f"Good rating: {rating}/5")
    elif rating >= 3.5:
        score += 10; factors.append(f"Average rating: {rating}/5")

    if ratings_count >= 10000:
        score += 30; factors.append(f"Very popular: {ratings_count:,} reviews")
    elif ratings_count >= 1000:
        score += 20; factors.append(f"Popular: {ratings_count:,} reviews")
    elif ratings_count >= 100:
        score += 10; factors.append(f"Moderate: {ratings_count:,} reviews")
    elif ratings_count > 0:
        score += 5; factors.append(f"Few reviews: {ratings_count}")

    high_demand = ["fiction", "self-help", "business", "biography", "science", "technology", "history"]
    for cat in [c.lower() for c in (google_data.get("categories") or [])]:
        if any(h in cat for h in high_demand):
            score += 10; factors.append(f"High-demand category: {cat}"); break

    score = min(score, 100)
    label = "High" if score >= 70 else ("Medium" if score >= 45 else "Low")
    return {"score": round(score), "label": label, "factors": factors, "based_on": "Google Books ratings & category signals"}


async def process_book_image(image_base64: str, media_type: str = "image/jpeg") -> Dict[str, Any]:
    """Full pipeline: image → AI (Gemini free) → metadata APIs → enriched book data"""
    result = {
        "title": None, "subtitle": None, "authors": [], "publisher": None,
        "publication_date": None, "edition": None, "language": None,
        "isbn_10": None, "isbn_13": None, "page_count": None, "categories": [],
        "description": None, "author_details": None, "demand_score": None,
        "demand_label": None, "ai_confidence": None,
        "verification_status": "pending", "data_source": None, "raw_ai_response": None,
    }

    # Step 1: Vision AI
    print("📸 Running Gemini Vision extraction...")
    try:
        ai_data = await extract_with_vision(image_base64, media_type)
        result["raw_ai_response"] = json.dumps(ai_data)
        result["ai_confidence"] = ai_data.get("confidence", 0.5)
        result["data_source"] = "gemini_vision"
    except Exception as e:
        print(f"Vision API error: {e}")
        result["verification_status"] = "ai_failed"
        result["raw_ai_response"] = json.dumps({"error": str(e)})
        return result

    result["title"] = ai_data.get("title")
    result["subtitle"] = ai_data.get("subtitle")
    result["authors"] = ai_data.get("authors", [])
    result["publisher"] = ai_data.get("publisher")
    result["publication_date"] = ai_data.get("publication_year")
    result["edition"] = ai_data.get("edition")
    result["language"] = ai_data.get("language")

    for isbn in ai_data.get("isbn_candidates", []):
        cleaned = re.sub(r'[-\s]', '', isbn)
        if len(cleaned) == 13:
            result["isbn_13"] = cleaned
        elif len(cleaned) == 10:
            result["isbn_10"] = cleaned

    # Step 2: Google Books
    print("📚 Looking up Google Books...")
    isbn_to_lookup = result["isbn_13"] or result["isbn_10"]
    google_data = await lookup_google_books(
        isbn=isbn_to_lookup,
        title=result["title"],
        author=result["authors"][0] if result["authors"] else None
    )

    if google_data:
        print("✅ Google Books hit!")
        result["data_source"] = "google_books"
        result["ai_confidence"] = min(0.97, (result["ai_confidence"] or 0.7) + 0.15)
        result["title"] = google_data.get("title") or result["title"]
        result["subtitle"] = google_data.get("subtitle") or result["subtitle"]
        result["authors"] = google_data.get("authors") or result["authors"]
        result["publisher"] = google_data.get("publisher") or result["publisher"]
        result["publication_date"] = google_data.get("publication_date") or result["publication_date"]
        result["page_count"] = google_data.get("page_count")
        result["categories"] = google_data.get("categories") or []
        result["language"] = google_data.get("language") or result["language"]
        result["description"] = google_data.get("description")
        result["isbn_10"] = google_data.get("isbn_10") or result["isbn_10"]
        result["isbn_13"] = google_data.get("isbn_13") or result["isbn_13"]
        demand = calculate_demand_score(google_data, ai_data)
    else:
        print("📖 Trying Open Library fallback...")
        ol_data = await lookup_open_library(isbn=isbn_to_lookup, title=result["title"])
        if ol_data:
            print("✅ Open Library hit!")
            result["data_source"] = "open_library"
            result["title"] = ol_data.get("title") or result["title"]
            result["authors"] = ol_data.get("authors") or result["authors"]
            result["publisher"] = ol_data.get("publisher") or result["publisher"]
            result["publication_date"] = ol_data.get("publication_date") or result["publication_date"]
            result["categories"] = ol_data.get("categories") or []
            result["isbn_13"] = ol_data.get("isbn_13") or result["isbn_13"]
        demand = calculate_demand_score(None, ai_data)

    result["demand_score"] = demand["score"]
    result["demand_label"] = demand["label"]

    # Step 4: Author details
    if result["authors"]:
        print(f"👤 Fetching author details for: {result['authors'][0]}")
        author_info = await get_author_details(result["authors"][0])
        if author_info:
            result["author_details"] = json.dumps(author_info)

    # Step 5: Verification status
    confidence = result["ai_confidence"] or 0
    if confidence >= 0.85 and result["data_source"] in ("google_books", "open_library"):
        result["verification_status"] = "verified"
    elif confidence >= 0.65:
        result["verification_status"] = "needs_review"
    else:
        result["verification_status"] = "low_confidence"

    return result