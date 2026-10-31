"""Production ASGI entrypoint for Vercel (and other hosts that import `app` directly)."""
from .main import create_app

app = create_app()
