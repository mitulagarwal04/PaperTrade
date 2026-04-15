from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async for session in get_session():
        yield session


DBSession = Depends(get_db)
