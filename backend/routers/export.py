"""
Export router - generate CSV and Excel files from session data
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import pandas as pd
import io
import json
from datetime import datetime

from database import get_db, ScannedBook, ScanSession
from routers.auth import verify_token

router = APIRouter()


def get_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return verify_token(authorization.split(" ")[1])


def books_to_dataframe(books: list) -> pd.DataFrame:
    """Convert list of ScannedBook models to a clean DataFrame"""
    rows = []
    for i, book in enumerate(books, 1):
        # Parse JSON fields
        authors = []
        if book.authors:
            try:
                authors = json.loads(book.authors)
            except:
                authors = [book.authors]

        categories = []
        if book.categories:
            try:
                categories = json.loads(book.categories)
            except:
                pass

        author_details = ""
        if book.author_details:
            try:
                details = json.loads(book.author_details)
                parts = []
                if details.get("name"):
                    parts.append(f"Name: {details['name']}")
                if details.get("birth_date"):
                    parts.append(f"Born: {details['birth_date']}")
                if details.get("work_count"):
                    parts.append(f"Works: {details['work_count']}")
                if details.get("top_subjects"):
                    parts.append(f"Subjects: {', '.join(details['top_subjects'][:3])}")
                author_details = " | ".join(parts)
            except:
                pass

        rows.append({
            "S.No": i,
            "ISBN-10": book.isbn_10 or "",
            "ISBN-13": book.isbn_13 or "",
            "Title": book.title or "",
            "Subtitle": book.subtitle or "",
            "Author(s)": ", ".join(authors),
            "Publisher": book.publisher or "",
            "Publication Date": book.publication_date or "",
            "Edition": book.edition or "",
            "Language": book.language or "",
            "Pages": book.page_count or "",
            "Categories": ", ".join(categories),
            "Description": book.description or "",
            "Author Details": author_details,
            "Demand Score": book.demand_score or "",
            "Demand Label": book.demand_label or "",
            "AI Confidence (%)": f"{round((book.ai_confidence or 0) * 100)}%",
            "Verification Status": book.verification_status or "",
            "Data Source": book.data_source or "",
            "Scanned At": book.created_at.strftime("%Y-%m-%d %H:%M") if book.created_at else "",
        })

    return pd.DataFrame(rows)


@router.get("/sessions/{session_id}/csv")
async def export_csv(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """Export session books as CSV"""
    # Verify session
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get books
    books_result = await db.execute(
        select(ScannedBook)
        .where(ScannedBook.session_id == session_id)
        .order_by(ScannedBook.created_at.asc())
    )
    books = books_result.scalars().all()

    if not books:
        raise HTTPException(status_code=404, detail="No books in this session")

    df = books_to_dataframe(books)

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    filename = f"library_scan_{session.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sessions/{session_id}/xlsx")
async def export_excel(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    """Export session books as Excel (.xlsx)"""
    # Verify session
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get books
    books_result = await db.execute(
        select(ScannedBook)
        .where(ScannedBook.session_id == session_id)
        .order_by(ScannedBook.created_at.asc())
    )
    books = books_result.scalars().all()

    if not books:
        raise HTTPException(status_code=404, detail="No books in this session")

    df = books_to_dataframe(books)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Scanned Books")

        # Style the worksheet
        worksheet = writer.sheets["Scanned Books"]

        # Auto-adjust column widths
        for column in worksheet.columns:
            max_length = 0
            col_letter = column[0].column_letter
            for cell in column:
                try:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[col_letter].width = adjusted_width

        # Bold header row
        from openpyxl.styles import Font, PatternFill, Alignment
        header_fill = PatternFill(start_color="1a3c5e", end_color="1a3c5e", fill_type="solid")
        for cell in worksheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        # Add session info sheet
        info_data = {
            "Field": ["Session Name", "Location", "Department", "Export Date", "Total Books"],
            "Value": [
                session.name,
                session.location or "N/A",
                session.department or "N/A",
                datetime.now().strftime("%Y-%m-%d %H:%M"),
                len(books)
            ]
        }
        info_df = pd.DataFrame(info_data)
        info_df.to_excel(writer, index=False, sheet_name="Session Info")

    output.seek(0)
    filename = f"library_scan_{session.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
