from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def make_session_factory():
    """Create and return an async session factory."""
    global _engine, _session_factory
    settings = get_settings()
    _engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_size=20,
        max_overflow=30,
        pool_timeout=30,
    )
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return _session_factory


async def get_session() -> AsyncSession:
    """Get a database session. Factory is lazily initialized."""
    global _session_factory
    if _session_factory is None:
        _session_factory = make_session_factory()
    async with _session_factory() as session:
        yield session


async def init_db():
    """Initialize database tables."""
    global _engine
    if _engine is None:
        make_session_factory()
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
