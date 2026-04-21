"""Test configuration and fixtures."""
import asyncio
import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.database import Base, init_db
from app.models.portfolio import UserCash


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def session():
    """Create a fresh database session for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def user_cash(session):
    """Create test user cash."""
    cash = UserCash(
        total_inr=Decimal("100000.00"),
        reserved_inr=Decimal("0.00"),
        available_inr=Decimal("100000.00"),
    )
    session.add(cash)
    await session.commit()
    return cash


@pytest.fixture
def mock_cache_manager():
    """Mock cache manager."""
    mock = MagicMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=None)
    return mock
