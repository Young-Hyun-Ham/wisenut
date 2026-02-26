from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core import config
from .routers import (
    auth,
    files,
    health,
    posts,
    scenario_categories,
    scenarios,
    settings,
    templates,
)


app = FastAPI(
    title="Chatbot Admin Backend API",
    version="0.1.0",
    description="Design-first skeleton for chatbot-admin-backend.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health)
app.include_router(auth)
app.include_router(scenarios)
app.include_router(templates)
app.include_router(scenario_categories)
app.include_router(settings)
app.include_router(posts)
app.include_router(files)


@app.get("/")
def root():
    return {"status": "ok", "service": "chatbot-admin-backend"}
