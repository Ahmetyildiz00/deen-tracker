import calendar
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import and_, inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import DailyEntry, User

# Tracked habits, in display order.
FIELDS = ("quran", "hadith", "kusluk", "teheccud")


def _ensure_columns():
    """Add habit columns to an existing daily_entries table if missing."""
    inspector = inspect(engine)
    if "daily_entries" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("daily_entries")}
    with engine.begin() as conn:
        for field in FIELDS:
            if field not in existing:
                conn.execute(
                    text(
                        f"ALTER TABLE daily_entries "
                        f"ADD COLUMN {field} BOOLEAN NOT NULL DEFAULT false"
                    )
                )


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
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
        entries = {
            r.date.isoformat(): {f: getattr(r, f) for f in FIELDS} for r in rows
        }
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


@app.get("/api/month")
def get_month(month_offset: int = 0, db: Session = Depends(get_db)):
    today = date.today()
    year = today.year + (today.month - 1 + month_offset) // 12
    month = (today.month - 1 + month_offset) % 12 + 1
    days_in_month = calendar.monthrange(year, month)[1]
    first = date(year, month, 1)
    last = date(year, month, days_in_month)

    users = db.query(User).order_by(User.id).all()

    users_data = []
    for user in users:
        rows = (
            db.query(DailyEntry)
            .filter(
                and_(
                    DailyEntry.user_id == user.id,
                    DailyEntry.date >= first,
                    DailyEntry.date <= last,
                )
            )
            .all()
        )
        entries = {
            r.date.isoformat(): {f: getattr(r, f) for f in FIELDS} for r in rows
        }
        users_data.append({
            "id": user.id,
            "name": user.name,
            "entries": entries,
        })

    days = [
        {
            "date": d.isoformat(),
            "day_name": TURKISH_DAYS[d.weekday()],
            "weekday": d.weekday(),
            "day_num": d.day,
            "is_today": d == today,
        }
        for d in (first + timedelta(days=i) for i in range(days_in_month))
    ]

    return {
        "month_label": f"{TURKISH_MONTHS[month]} {year}",
        "month_offset": month_offset,
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
        entry = DailyEntry(user_id=body.user_id, date=d)
        db.add(entry)
        db.flush()

    if body.field in FIELDS:
        setattr(entry, body.field, not getattr(entry, body.field))

    db.commit()
    return {"ok": True, **{f: getattr(entry, f) for f in FIELDS}}


# --- Serve React build ---
BUILD_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    file = BUILD_DIR / full_path
    if file.is_file():
        return FileResponse(file)
    return FileResponse(BUILD_DIR / "index.html")
