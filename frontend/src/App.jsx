import { useState, useEffect, useCallback } from 'react'
import './App.css'

const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ'

// Tracked habits, in display order. Must stay in sync with backend FIELDS.
const HABITS = [
  { key: 'quran', label: "Kur'an", short: 'Q', cls: 'quran-icon' },
  { key: 'hadith', label: 'Hadis', short: 'H', cls: 'hadith-icon' },
  { key: 'kusluk', label: 'Kuşluk', short: 'K', cls: 'kusluk-icon' },
  { key: 'teheccud', label: 'Teheccüd', short: 'T', cls: 'teheccud-icon' },
]

const VIEWS = [
  { key: 'day', label: 'Günlük' },
  { key: 'month', label: 'Aylık' },
]

// Today's date in Turkish, e.g. "9 Haziran 2026, Salı".
const TODAY_LABEL = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
}).format(new Date())

function ProgressRing({ current, total, size = 48, stroke = 4 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? current / total : 0
  const offset = circumference - progress * circumference

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--border)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--primary)" strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill="var(--primary)" fontSize={size * 0.26} fontWeight="700">
        {current}
      </text>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function App() {
  const [view, setView] = useState('day')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [fetching, setFetching] = useState(false)

  // Reset navigation offset whenever the view changes.
  useEffect(() => { setOffset(0) }, [view])

  const fetchData = useCallback(async () => {
    setFetching(true)
    const endpoint = view === 'month'
      ? `/api/month?month_offset=${offset}`
      : `/api/week?week_offset=${offset}`
    try {
      const res = await fetch(endpoint)
      const text = await res.text()
      if (!res.ok || text.trimStart().startsWith('<')) {
        throw new Error(`Beklenmeyen yanıt: ${endpoint}`)
      }
      setData(JSON.parse(text))
    } catch (err) {
      console.error('Veri alınamadı:', err)
    } finally {
      setFetching(false)
    }
  }, [view, offset])

  useEffect(() => { fetchData() }, [fetchData])

  const handleToggle = async (userId, date, field) => {
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u
        const entries = { ...u.entries }
        const current = entries[date] || {}
        entries[date] = { ...current, [field]: !current[field] }
        return { ...u, entries }
      })
    }))

    await fetch('/api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date, field }),
    })
  }

  if (!data) {
    return (
      <div className="page">
        <div className="loader">
          <div className="loader-spinner" />
        </div>
      </div>
    )
  }

  // Daily view always shows today (no navigation).
  const today = data.days.find(d => d.is_today) || data.days[0]

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="header-ornament" />
        <p className="bismillah">{BISMILLAH}</p>
        <p className="bismillah-date">16.05.2026</p>
      </header>

      {/* View Switcher */}
      <div className="view-switcher">
        {VIEWS.map(v => (
          <button
            key={v.key}
            className={`view-tab ${view === v.key ? 'active' : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Date bar: today's date in daily view, month + arrows in monthly view */}
      {view === 'day' ? (
        <nav className="week-nav centered">
          <div className="nav-label">
            <span className="nav-month">{TODAY_LABEL}</span>
          </div>
        </nav>
      ) : (
        <nav className="week-nav">
          <button className="nav-btn" onClick={() => setOffset(o => o - 1)} aria-label="Önceki ay">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="nav-label">
            <span className="nav-month">{data.month_label}</span>
            {offset !== 0 && (
              <button className="today-chip" onClick={() => setOffset(0)}>Bu ay</button>
            )}
          </div>
          <button className="nav-btn" onClick={() => setOffset(o => o + 1)} aria-label="Sonraki ay">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </nav>
      )}

      {/* Users */}
      <div style={{ opacity: fetching ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
        {data.users.map(user => (
          view === 'day'
            ? <DayCard key={user.id} user={user} day={today} onToggle={handleToggle} />
            : <MonthCard key={user.id} user={user} days={data.days} onToggle={handleToggle} />
        ))}
      </div>
    </div>
  )
}

// --- Daily view: one card per user, large toggles for today only ---
function DayCard({ user, day, onToggle }) {
  const doneCount = HABITS.filter(h => user.entries[day.date]?.[h.key]).length

  return (
    <section className="user-card">
      <div className="user-header">
        <div className="user-avatar">{user.name.charAt(0)}</div>
        <div className="user-info">
          <h2 className="user-name">{user.name}</h2>
          <p className="user-streak">Bugün {doneCount}/{HABITS.length} tamamlandı</p>
        </div>
        <ProgressRing current={doneCount} total={HABITS.length} />
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${(doneCount / HABITS.length) * 100}%` }} />
      </div>

      <div className="day-habits">
        {HABITS.map(h => {
          const checked = user.entries[day.date]?.[h.key] || false
          return (
            <button
              key={h.key}
              className={`day-habit ${h.cls} ${checked ? 'on' : ''}`}
              onClick={() => onToggle(user.id, day.date, h.key)}
            >
              <span className="day-habit-icon">{checked ? <CheckIcon /> : h.short}</span>
              <span className="day-habit-label">{h.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

const WEEKDAY_HEADERS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// --- Monthly view: calendar grid; each day has 4 inline habit toggles ---
function MonthCard({ user, days, onToggle }) {
  const total = days.length * HABITS.length
  const doneCount = days.reduce(
    (sum, d) => sum + HABITS.filter(h => user.entries[d.date]?.[h.key]).length,
    0,
  )

  // Empty leading cells so day 1 lands under its weekday column (Mon = 0).
  const leadingBlanks = days.length ? days[0].weekday : 0

  return (
    <section className="user-card">
      <div className="user-header">
        <div className="user-avatar">{user.name.charAt(0)}</div>
        <div className="user-info">
          <h2 className="user-name">{user.name}</h2>
          <p className="user-streak">Bu ay {doneCount}/{total} tamamlandı</p>
        </div>
        <ProgressRing current={doneCount} total={total} />
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
      </div>

      {/* Habit legend */}
      <div className="calendar-legend">
        {HABITS.map(h => (
          <span className="legend-item" key={h.key}>
            <span className={`legend-swatch ${h.cls}`} />
            {h.label}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <div className="calendar">
        {WEEKDAY_HEADERS.map(w => (
          <div className="calendar-weekday" key={w}>{w}</div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div className="calendar-blank" key={`blank-${i}`} />
        ))}
        {days.map(day => {
          const entry = user.entries[day.date] || {}
          const doneToday = HABITS.filter(h => entry[h.key]).length
          return (
            <div
              key={day.date}
              className={`calendar-day ${day.is_today ? 'today' : ''} ${doneToday === HABITS.length ? 'complete' : ''}`}
            >
              <span className="calendar-day-num">{day.day_num}</span>
              <div className="calendar-cells">
                {HABITS.map(h => {
                  const checked = entry[h.key] || false
                  return (
                    <button
                      key={h.key}
                      className={`calendar-cell ${h.cls} ${checked ? 'on' : ''}`}
                      onClick={() => onToggle(user.id, day.date, h.key)}
                      aria-label={`${day.day_num} ${h.label}`}
                      title={h.label}
                    >
                      {checked ? h.short : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default App
