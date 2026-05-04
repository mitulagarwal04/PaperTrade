"""PaperTrade API main application."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.routes.prices import router as prices_router
from app.api.routes.orders import router as orders_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.charts import router as charts_router
from app.websocket.manager import ConnectionManager
from app.cache.manager import CacheManager
from app.providers.registry import ProviderRegistry
from app.tasks.order_monitor import get_order_monitor, reset_order_monitor

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


async def check_orders(app: FastAPI):
    """Background task to check and fill conditional orders."""
    while True:
        try:
            from app.database import make_session_factory
            from sqlalchemy.ext.asyncio import AsyncSession

            session_factory = make_session_factory()
            monitor = get_order_monitor(session_factory=session_factory)

            if monitor.session_factory is None:
                monitor.session_factory = session_factory

            await monitor._check_orders()
        except Exception as e:
            print(f"Order check error: {e}")

        await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    await init_db()

    # Initialize user cash if needed
    try:
        from app.database import make_session_factory
        from sqlalchemy import select
        from app.models.portfolio import UserCash

        session_factory = make_session_factory()
        async with session_factory() as session:
            result = await session.execute(select(UserCash).limit(1))
            cash = result.scalar_one_or_none()
            if cash is None:
                cash = UserCash(total_inr=100000)
                session.add(cash)
                await session.commit()
                print("Initialized UserCash: 100,000 INR")
    except Exception as e:
        print(f"Error initializing UserCash: {e}")

    # Start background tasks
    app.state.price_task = asyncio.create_task(broadcast_prices(app))
    app.state.order_task = asyncio.create_task(check_orders(app))

    yield

    # Cleanup
    app.state.price_task.cancel()
    app.state.order_task.cancel()

    try:
        await app.state.price_task
    except asyncio.CancelledError:
        pass

    try:
        await app.state.order_task
    except asyncio.CancelledError:
        pass

    # Stop order monitor
    try:
        monitor = get_order_monitor()
        await monitor.stop()
    except Exception:
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

    # Include routers
    app.include_router(prices_router, prefix="/api/v1")
    app.include_router(orders_router, prefix="/api/v1")
    app.include_router(portfolio_router, prefix="/api/v1")
    app.include_router(charts_router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {
            "message": "PaperTrade API",
            "version": "0.1.0",
        }

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
