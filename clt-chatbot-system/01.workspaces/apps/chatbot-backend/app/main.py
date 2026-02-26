import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .notifications.bus import NotificationEventBus
from .notifications.sources import create_pg_notify_source
from .routers import health, auth, users, mock, notifications, chat, conversations
from .middleware.reqres_logger import RequestResponseLoggerMiddleware, _parse_endpoints

app = FastAPI(
    title="Chatbot Backend API",
    version="0.1.0",
    description="Design-first skeleton for chatbot-backend.",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log_endpoints = ["/scenario-sessions"]
app.add_middleware(
    RequestResponseLoggerMiddleware,
    endpoints=log_endpoints,
    max_body_bytes=int(os.getenv("LOG_BODY_MAX_BYTES", "2000")),
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(mock.router)
app.include_router(notifications.router)
app.include_router(chat.router)


@app.on_event("startup")
async def startup_event():
    app.state.notification_bus = NotificationEventBus()
    app.state.notification_source = create_pg_notify_source(app.state.notification_bus)
    if app.state.notification_source:
        await app.state.notification_source.start()


@app.on_event("shutdown")
async def shutdown_event():
    source = getattr(app.state, "notification_source", None)
    if source:
        await source.stop()


@app.get("/")
def root():
    return {"status": "ok", "service": "chatbot-backend"}
