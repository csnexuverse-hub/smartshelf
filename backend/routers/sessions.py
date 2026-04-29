"""
Scan Sessions router - create/list/get sessions
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from database import get_db, ScanSession, ScannedBook
from routers.auth import verify_token

router = APIRouter()


def get_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return verify_token(authorization.split(" ")[1])


class CreateSessionRequest(BaseModel):
    name: str
    location: Optional[str] = None
    department: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    name: str
    location: Optional[str]
    department: Optional[str]
    created_at: datetime
    book_count: int = 0


@router.post("/", response_model=SessionResponse)
async def create_session(
    req: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    session = ScanSession(
        id=str(uuid.uuid4()),
        user_id=user["sub"],
        name=req.name,
        location=req.location,
        department=req.department
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(
        id=session.id,
        name=session.name,
        location=session.location,
        department=session.department,
        created_at=session.created_at,
        book_count=0
    )


@router.get("/", response_model=List[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    result = await db.execute(
        select(ScanSession)
        .where(ScanSession.user_id == user["sub"])
        .order_by(ScanSession.created_at.desc())
    )
    sessions = result.scalars().all()

    response = []
    for s in sessions:
        count_result = await db.execute(
            select(ScannedBook).where(ScannedBook.session_id == s.id)
        )
        book_count = len(count_result.scalars().all())
        response.append(SessionResponse(
            id=s.id,
            name=s.name,
            location=s.location,
            department=s.department,
            created_at=s.created_at,
            book_count=book_count
        ))
    return response


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    count_result = await db.execute(
        select(ScannedBook).where(ScannedBook.session_id == session_id)
    )
    book_count = len(count_result.scalars().all())

    return SessionResponse(
        id=s.id,
        name=s.name,
        location=s.location,
        department=s.department,
        created_at=s.created_at,
        book_count=book_count
    )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_user)
):
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.id == session_id,
            ScanSession.user_id == user["sub"]
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(s)
    await db.commit()
    return {"message": "Session deleted"}
