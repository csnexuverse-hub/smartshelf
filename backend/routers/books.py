"""
Books router - the main workhorse endpoint
Handles image upload → AI processing → storing results
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import uuid
import base64
import json
from datetime import datetime

from database import get_db, ScannedBook, ScanSession
from routers.auth import verify_token
from services.ai_pipeline import process_book_image

router = APIRouter()


def get_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return verify_token(authorization.split(" ")[1])


class BookResponse(BaseModel):
    id: str
    session_id: str
    title: Optional[str]
    subtitle: Optional[str]
    authors: List[str]
    publisher: Optional[str]
    publication_date: Optional[str]
    edition: Optional[str]
    language: Optional[str]
    isbn_10: Optional[str]
    isbn_13: Optional[str]
    page_count: Optional[int]
    categories: List[str]
    description: Optional[str]
    author_details: Optional[dict]
    demand_score: Optional[float]
    demand_label: Optional[str]
    ai_confidence: Optional[float]
    verification_status: str
    data_source: Optional[str]
    has_image: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateBookRequest(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    authors: Optional[List[str]] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    edition: Optional[str] = None
    language: Optional[str] = None
    isbn_10: Optional[str] = None
    isbn_13: Optional[str] = None
    page_count: Optional[int] = None
    categories: Optional[List[str]] = None
    description: Optional[str] = None
    demand_label: Optional[str] = None
    verification_status: Optional[str] = None


def book_to_response(book: ScannedBook) -> BookResponse:
    """Convert DB model to API response"""
    authors = []
    if book.authors:
        try:
            authors = json.loads(book.authors)
        except:
            authors = [book.authors] if book.authors else []

    categories = []
    if book.categories:
        try:
            categories = json.loads(book.categories)
        except:
            categories = []

    author_details = None
    if book.author_details:
        try:
            author_details = json.loads(book.author_details)
        except:
            pass

    return BookResponse(
        id=book.id,
        session_id=book.session_id,
        title=book.title,
        subtitle=book.subtitle,
        authors=authors,
        publisher=book.publisher,
        publication_date=book.publication_date,
        edition=book.edition,
        language=book.language,
        isbn_10=book.isbn_10,
        isbn_13=book.isbn_13,
        page_count=book.page_count,
        categories=categories,
        description=book.description,
        author_details=author_details,
        demand_score=book.demand_score,
        demand_label=book.demand_label,
        ai_confidence=book.ai_confidence,
        verification_status=book.verification_status,
        data_source=book.data_source,
        has_image=bool(book.image_data),
        created_at=book.created_at
    )


@router.post("/sessions/{session_id}/scan")
async def scan_book(
    session_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """
    Upload a book image, run the full AI pipeline, and save results.
    This is the main endpoint.
    """
    # Verify session belongs to user
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and encode image
    image_bytes = await file.read()
    if len(image_bytes) > 15 * 1024 * 1024:  # 15MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 15MB)")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    media_type = file.content_type or "image/jpeg"

    # Run AI pipeline
    try:
        extracted = await process_book_image(image_base64, media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

    # Save to database
    book = ScannedBook(
        id=str(uuid.uuid4()),
        session_id=session_id,
        image_data=image_base64,
        title=extracted.get("title"),
        subtitle=extracted.get("subtitle"),
        authors=json.dumps(extracted.get("authors", [])),
        publisher=extracted.get("publisher"),
        publication_date=extracted.get("publication_date"),
        edition=extracted.get("edition"),
        language=extracted.get("language"),
        isbn_10=extracted.get("isbn_10"),
        isbn_13=extracted.get("isbn_13"),
        page_count=extracted.get("page_count"),
        categories=json.dumps(extracted.get("categories", [])),
        description=extracted.get("description"),
        author_details=extracted.get("author_details"),
        demand_score=extracted.get("demand_score"),
        demand_label=extracted.get("demand_label"),
        ai_confidence=extracted.get("ai_confidence"),
        verification_status=extracted.get("verification_status", "pending"),
        data_source=extracted.get("data_source"),
        raw_ai_response=str(extracted.get("raw_ai_response", ""))[:5000]
    )

    db.add(book)
    await db.commit()
    await db.refresh(book)

    return book_to_response(book)


@router.get("/sessions/{session_id}/books", response_model=List[BookResponse])
async def list_session_books(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """Get all books in a session"""
    # Verify session ownership
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    books_result = await db.execute(
        select(ScannedBook)
        .where(ScannedBook.session_id == session_id)
        .order_by(ScannedBook.created_at.asc())
    )
    books = books_result.scalars().all()
    return [book_to_response(b) for b in books]


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    result = await db.execute(select(ScannedBook).where(ScannedBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book_to_response(book)


@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    updates: UpdateBookRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """Manually correct book data"""
    result = await db.execute(select(ScannedBook).where(ScannedBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if updates.title is not None:
        book.title = updates.title
    if updates.subtitle is not None:
        book.subtitle = updates.subtitle
    if updates.authors is not None:
        book.authors = json.dumps(updates.authors)
    if updates.publisher is not None:
        book.publisher = updates.publisher
    if updates.publication_date is not None:
        book.publication_date = updates.publication_date
    if updates.edition is not None:
        book.edition = updates.edition
    if updates.language is not None:
        book.language = updates.language
    if updates.isbn_10 is not None:
        book.isbn_10 = updates.isbn_10
    if updates.isbn_13 is not None:
        book.isbn_13 = updates.isbn_13
    if updates.page_count is not None:
        book.page_count = updates.page_count
    if updates.categories is not None:
        book.categories = json.dumps(updates.categories)
    if updates.description is not None:
        book.description = updates.description
    if updates.demand_label is not None:
        book.demand_label = updates.demand_label
    if updates.verification_status is not None:
        book.verification_status = updates.verification_status

    await db.commit()
    await db.refresh(book)
    return book_to_response(book)


@router.delete("/{book_id}")
async def delete_book(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    result = await db.execute(select(ScannedBook).where(ScannedBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    await db.delete(book)
    await db.commit()
    return {"message": "Book deleted"}


@router.get("/{book_id}/image")
async def get_book_image(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """Return book image as base64"""
    result = await db.execute(select(ScannedBook).where(ScannedBook.id == book_id))
    book = result.scalar_one_or_none()
    if not book or not book.image_data:
        raise HTTPException(status_code=404, detail="Image not found")
    return {"image_base64": book.image_data}
