"""Background task for monitoring and executing conditional orders."""
import asyncio
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.order import Order, OrderStatus, OrderType
from app.services.order_service import OrderService


class OrderMonitor:
    """Monitors open orders and executes when conditions are met."""

    def __init__(
        self,
        session_factory: async_sessionmaker = None,
        check_interval: float = 5.0,
    ):
        """Initialize order monitor.

        Args:
            session_factory: Async session factory
            check_interval: Seconds between checks
        """
        self.session_factory = session_factory
        self.check_interval = check_interval
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task] = None
        self._is_running = False

    async def start(self) -> None:
        """Start the monitor loop."""
        if self._is_running:
            return

        self._stop_event = asyncio.Event()
        self._is_running = True
        self._task = asyncio.create_task(self._monitor_loop())

    async def stop(self) -> None:
        """Stop the monitor loop gracefully."""
        if not self._is_running:
            return

        self._stop_event.set()
        self._is_running = False

        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except asyncio.TimeoutError:
                self._task.cancel()

    async def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        while not self._stop_event.is_set():
            try:
                await self._check_orders()
            except Exception as e:
                # Log error but keep monitoring
                from app.config import get_settings
                settings = get_settings()
                if settings.debug:
                    print(f"Order monitor error: {e}")

            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self.check_interval
                )
            except asyncio.TimeoutError:
                continue

    async def _check_orders(self) -> None:
        """Check and fill pending orders."""
        if self.session_factory is None:
            from app.database import make_session_factory
            self.session_factory = make_session_factory()

        async with self.session_factory() as session:
            try:
                order_service = OrderService(session)
                await order_service.check_and_fill_pending_orders()
                await session.commit()
            except Exception:
                await session.rollback()
                raise


# Global instance
_order_monitor: Optional[OrderMonitor] = None


def get_order_monitor(
    session_factory: async_sessionmaker = None,
    check_interval: float = 5.0,
) -> OrderMonitor:
    """Get or create global order monitor."""
    global _order_monitor
    if _order_monitor is None:
        _order_monitor = OrderMonitor(
            session_factory=session_factory,
            check_interval=check_interval,
        )
    return _order_monitor


def reset_order_monitor() -> None:
    """Reset global monitor (for testing)."""
    global _order_monitor
    _order_monitor = None
