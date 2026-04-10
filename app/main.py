from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import DailyEntry, User

app = FastAPI(title="Deen Tracker")

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        for name in ("Ahmet", "Müzeyyen"):
            if not db.query(User).filter(User.name == name).first():
                db.add(User(name=name))
        db.commit()
    finally:
        db.close()


def _get_week_dates(ref: date) -> list[date]:
    """Verilen tarihi içeren haftanın Pazartesi-Pazar tarihlerini döndürür."""
    monday = ref - timedelta(days=ref.weekday())
    return [monday + timedelta(days=i) for i in range(7)]


TURKISH_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
TURKISH_MONTHS = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]


@app.get("/", response_class=HTMLResponse)
def index(request: Request, week_offset: int = 0, db: Session = Depends(get_db)):
    today = date.today()
    ref = today + timedelta(weeks=week_offset)
    week_dates = _get_week_dates(ref)

    users = db.query(User).order_by(User.id).all()

    entries_map: dict[int, dict[date, DailyEntry]] = {}
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
        entries_map[user.id] = {r.date: r for r in rows}

    week_display = []
    for d in week_dates:
        week_display.append(
            {
                "date": d,
                "day_name": TURKISH_DAYS[d.weekday()],
                "day_num": d.day,
                "is_today": d == today,
            }
        )

    month_label = f"{TURKISH_MONTHS[ref.month]} {ref.year}"

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "users": users,
            "week_display": week_display,
            "entries_map": entries_map,
            "week_offset": week_offset,
            "month_label": month_label,
            "today": today,
        },
    )


@app.post("/toggle")
def toggle(
    request: Request,
    user_id: int = 0,
    entry_date: str = "",
    field: str = "",
    week_offset: int = 0,
    db: Session = Depends(get_db),
):
    d = date.fromisoformat(entry_date)
    entry = (
        db.query(DailyEntry)
        .filter(and_(DailyEntry.user_id == user_id, DailyEntry.date == d))
        .first()
    )
    if not entry:
        entry = DailyEntry(user_id=user_id, date=d, quran=False, hadith=False)
        db.add(entry)
        db.flush()

    if field == "quran":
        entry.quran = not entry.quran
    elif field == "hadith":
        entry.hadith = not entry.hadith

    db.commit()
    return RedirectResponse(url=f"/?week_offset={week_offset}", status_code=303)
