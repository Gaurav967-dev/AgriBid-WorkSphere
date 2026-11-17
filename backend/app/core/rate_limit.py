from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory storage is used for local development.
# A shared storage backend should be configured for multi-worker deployments.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
)
