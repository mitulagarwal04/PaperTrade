import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.routes.prices import router as prices_router
from app.websocket.manager import ConnectionManager
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry

ws_manager = ConnectionManager()


async def broadcast_prices(app: FastAPI):
    """Background task to fetch and broadcast prices."""
    from app.database import make_session_factory

    session_factory = make_session_factory()

    while True:
        try:
            async with session_factory() as session:
                cache = CacheManager(session)
                registry = ProviderRegistry.create_default()

                symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "BTC", "ETH"]
                prices = {}

                for symbol in symbols:
                    try:
                        price = await registry.fetch_price(symbol)
                        await cache.set(symbol, price)
                        prices[symbol] = {
                            "price": price.price,
                            "currency": price.currency,
                            "source": price.source,
                        }
                    except Exception:
                        cached = await cache.get(symbol)
                        if cached:
                            prices[symbol] = {
                                "price": cached.price,
                                "currency": cached.currency,
                                "source": cached.source,
                                "is_stale": True,
                            }

                if prices:
                    await ws_manager.broadcast({
                        "type": "prices",
                        "data": prices,
                    })

        except Exception as e:
            print(f"Price broadcast error: {e}")

        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    await init_db()
    app.state.price_task = asyncio.create_task(broadcast_prices(app))
    yield
    app.state.price_task.cancel()
    try:
        await app.state.price_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    app = FastAPI(
        title="PaperTrade API",
        description="Real-time paper trading platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(prices_router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {"message": "PaperTrade API", "version": "0.1.0"}

    @app.websocket("/ws/prices")
    async def websocket_prices(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        except Exception:
            ws_manager.disconnect(websocket)

    return app


app = create_app()
