from __future__ import annotations

import time

from backend.src.services.rate_limiter import RateLimiter


def test_rate_limiter_enforces_limit() -> None:
    limiter = RateLimiter(rate_per_minute=2, refill_interval=1.0)
    assert limiter.acquire("adam4eve")
    assert limiter.acquire("adam4eve")
    assert not limiter.acquire("adam4eve")


def test_rate_limiter_refills_after_interval() -> None:
    limiter = RateLimiter(rate_per_minute=1, refill_interval=0.1)
    assert limiter.acquire("adam4eve")
    assert not limiter.acquire("adam4eve")
    time.sleep(0.11)
    assert limiter.acquire("adam4eve")
