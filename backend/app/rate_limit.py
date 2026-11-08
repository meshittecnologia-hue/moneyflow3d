"""Limite de tentativas em memória (um processo, suficiente para o Render gratuito)."""
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._calls: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        q = self._calls[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.max_calls:
            return False
        q.append(now)
        return True
