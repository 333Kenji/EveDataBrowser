from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class RateLimiter:
    rate_per_minute: int
    refill_interval: float = 60.0
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)
    _tokens: Dict[str, int] = field(default_factory=dict, init=False)
    _last_refill: Dict[str, float] = field(default_factory=dict, init=False)

    def acquire(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            tokens = self._tokens.get(key, self.rate_per_minute)
            last_refill = self._last_refill.get(key, now)
            elapsed = now - last_refill
            if elapsed >= self.refill_interval:
                tokens = self.rate_per_minute
                last_refill = now
            if tokens <= 0:
                self._tokens[key] = tokens
                self._last_refill[key] = last_refill
                return False
            tokens -= 1
            self._tokens[key] = tokens
            self._last_refill[key] = last_refill
            return True
