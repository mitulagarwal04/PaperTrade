from datetime import datetime
from typing import Optional
import re

from pydantic import BaseModel, field_validator


class AssetPrice(BaseModel):
    """Standardized price data across all providers."""

    symbol: str
    price: float
    currency: str
    timestamp: datetime
    source: str
    is_stale: bool = False

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Validate symbol format - alphanumeric with limited special chars."""
        if not re.match(r'^[A-Za-z0-9\-./]+$', v):
            raise ValueError(f"Invalid symbol format: {v}")
        return v.upper()

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Ensure currency is 3-letter code."""
        v = v.upper()
        if len(v) != 3:
            raise ValueError(f"Currency must be 3-letter code, got: {v}")
        return v

    def with_stale_flag(self, stale: bool = True) -> "AssetPrice":
        """Return copy with stale flag set."""
        data = self.model_dump()
        data["is_stale"] = stale
        return AssetPrice(**data)
