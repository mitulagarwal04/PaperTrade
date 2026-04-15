from typing import List

from fastapi import WebSocket


class ConnectionManager:
    """WebSocket connection manager.

    Tracks active connections and broadcasts messages to all clients.
    Handles disconnections gracefully.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and register a new connection."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Remove a connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> int:
        """Broadcast message to all connected clients.

        Returns:
            Number of clients that received the message
        """
        disconnected = []
        sent_count = 0

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                sent_count += 1
            except (RuntimeError, Exception):
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

        return sent_count

    async def send_to(self, websocket: WebSocket, message: dict) -> bool:
        """Send message to specific client."""
        try:
            await websocket.send_json(message)
            return True
        except (RuntimeError, Exception):
            self.disconnect(websocket)
            return False
