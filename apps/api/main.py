from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import scope, crisis, health, assess, lava

app = FastAPI(title="CrisisGrid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scope.router)
app.include_router(crisis.router)
app.include_router(health.router)
app.include_router(assess.router)
app.include_router(lava.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "crisisgrid-api"}
