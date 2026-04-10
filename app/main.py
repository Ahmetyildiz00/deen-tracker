from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import DailyEntry, User


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        for name in ("Ahmet", "Müzeyyen"):
            if not db.query(User).filter(User.name == name).first():
                db.add(User(name=name))
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(title="Deen Tracker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TURKISH_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
TURKISH_MONTHS = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]


def _get_week_dates(ref: date) -> list[date]:
    monday = ref - timedelta(days=ref.weekday())
    return [monday + timedelta(days=i) for i in range(7)]


# --- API ---

@app.get("/api/week")
def get_week(week_offset: int = 0, db: Session = Depends(get_db)):
    today = date.today()
    ref = today + timedelta(weeks=week_offset)
    week_dates = _get_week_dates(ref)

    users = db.query(User).order_by(User.id).all()

    users_data = []
    for user in users:
        rows = (
            db.query(DailyEntry)
            .filter(
                and_(
                    DailyEntry.user_id == user.id,
                    DailyEntry.date >= week_dates[0],
                    DailyEntry.date <= week_dates[-1],
                )
            )
            .all()
        )
        entries = {r.date.isoformat(): {"quran": r.quran, "hadith": r.hadith} for r in rows}
        users_data.append({
            "id": user.id,
            "name": user.name,
            "entries": entries,
        })

    days = [
        {
            "date": d.isoformat(),
            "day_name": TURKISH_DAYS[d.weekday()],
            "day_num": d.day,
            "is_today": d == today,
        }
        for d in week_dates
    ]

    return {
        "month_label": f"{TURKISH_MONTHS[ref.month]} {ref.year}",
        "week_offset": week_offset,
        "days": days,
        "users": users_data,
    }


class ToggleRequest(BaseModel):
    user_id: int
    date: str
    field: str


@app.post("/api/toggle")
def toggle(body: ToggleRequest, db: Session = Depends(get_db)):
    d = date.fromisoformat(body.date)
    entry = (
        db.query(DailyEntry)
        .filter(and_(DailyEntry.user_id == body.user_id, DailyEntry.date == d))
        .first()
    )
    if not entry:
        entry = DailyEntry(user_id=body.user_id, date=d, quran=False, hadith=False)
        db.add(entry)
        db.flush()

    if body.field == "quran":
        entry.quran = not entry.quran
    elif body.field == "hadith":
        entry.hadith = not entry.hadith

    db.commit()
    return {"ok": True, "quran": entry.quran, "hadith": entry.hadith}


# --- Serve React build ---
BUILD_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    file = BUILD_DIR / full_path
    if file.is_file():
        return FileResponse(file)
    return FileResponse(BUILD_DIR / "index.html")
