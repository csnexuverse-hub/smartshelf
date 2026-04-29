"""
Database setup using SQLAlchemy async with SQLite
No external DB server needed - just a local file
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import String, Float, Integer, DateTime, Text, JSON, ForeignKey
from datetime import datetime
from typing import Optional, List
import uuid

from config import settings


# Fix SQLite URL for async
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite+aiosqlite"):
    db_url = db_url.replace("sqlite:///", "sqlite+aiosqlite:///")

engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="librarian")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    department: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScannedBook(Base):
    __tablename__ = "scanned_books"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("scan_sessions.id"), nullable=False)

    # Image
    image_data: Mapped[Optional[str]] = mapped_column(Text)  # base64 stored in DB for simplicity

    # Identifiers
    isbn_10: Mapped[Optional[str]] = mapped_column(String(20))
    isbn_13: Mapped[Optional[str]] = mapped_column(String(20))

    # Core metadata
    title: Mapped[Optional[str]] = mapped_column(String(500))
    subtitle: Mapped[Optional[str]] = mapped_column(String(500))
    authors: Mapped[Optional[str]] = mapped_column(Text)  # JSON array as string
    publisher: Mapped[Optional[str]] = mapped_column(String(255))
    publication_date: Mapped[Optional[str]] = mapped_column(String(50))
    edition: Mapped[Optional[str]] = mapped_column(String(100))
    language: Mapped[Optional[str]] = mapped_column(String(50))
    page_count: Mapped[Optional[int]] = mapped_column(Integer)
    categories: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Author details
    author_details: Mapped[Optional[str]] = mapped_column(Text)  # JSON

    # Demand
    demand_score: Mapped[Optional[float]] = mapped_column(Float)
    demand_label: Mapped[Optional[str]] = mapped_column(String(20))  # Low/Medium/High

    # Quality
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float)
    verification_status: Mapped[str] = mapped_column(String(50), default="pending")
    data_source: Mapped[Optional[str]] = mapped_column(String(100))  # isbn_api/ai_vision/manual

    # Raw responses for debugging
    raw_ai_response: Mapped[Optional[str]] = mapped_column(Text)  # JSON

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


async def init_db():
    """Create all tables if they don't exist"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create default admin user if none exists
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).limit(1))
        if not result.scalar_one_or_none():
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            admin = User(
                username="admin",
                password_hash=pwd_context.hash("admin123"),
                role="admin"
            )
            session.add(admin)
            await session.commit()
            print("✅ Default user created: admin / admin123")


async def get_db():
    """Dependency: get async DB session"""
    async with AsyncSessionLocal() as session:
        yield session
