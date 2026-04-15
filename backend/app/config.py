from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    database_url: str
    debug: bool = False
    price_update_interval: int = 5
    cache_ttl_seconds: int = 300
    coingecko_api_key: Optional[str] = None
    alphavantage_api_key: Optional[str] = None
    twelvedata_api_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
