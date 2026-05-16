import { useState, useEffect, useCallback } from 'react'
import './App.css'

const BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650'

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
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState(null)
  const [fetching, setFetching] = useState(false)

  const fetchWeek = useCallback(async () => {
    setFetching(true)
    const res = await fetch(`/api/week?week_offset=${weekOffset}`)
    const json = await res.json()
    setData(json)
    setFetching(false)
  }, [weekOffset])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  const handleToggle = async (userId, date, field) => {
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => {
        if (u.id !== userId) return u
        const entries = { ...u.entries }
        const current = entries[date] || { quran: false, hadith: false }
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

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="header-ornament" />
        <p className="bismillah">{BISMILLAH}</p>
        <p className="bismillah-date">16.05.2026</p>
      </header>

      {/* Week Nav */}
      <nav className="week-nav">
        <button className="nav-btn" onClick={() => setWeekOffset(w => w - 1)} aria-label="Önceki hafta">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="nav-label">
          <span className="nav-month">{data.month_label}</span>
          {weekOffset !== 0 && (
            <button className="today-chip" onClick={() => setWeekOffset(0)}>Bugün</button>
          )}
        </div>
        <button className="nav-btn" onClick={() => setWeekOffset(w => w + 1)} aria-label="Sonraki hafta">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </nav>

      {/* Users */}
      <div style={{ opacity: fetching ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
      {data.users.map(user => {
        const quranCount = data.days.filter(d => user.entries[d.date]?.quran).length
        const hadithCount = data.days.filter(d => user.entries[d.date]?.hadith).length
        const totalCount = quranCount + hadithCount

        return (
          <section className="user-card" key={user.id}>
            {/* User Header */}
            <div className="user-header">
              <div className="user-avatar">
                {user.name.charAt(0)}
              </div>
              <div className="user-info">
                <h2 className="user-name">{user.name}</h2>
                <p className="user-streak">Bu hafta {totalCount}/14 tamamlandı</p>
              </div>
              <ProgressRing current={totalCount} total={14} />
            </div>

            {/* Progress Bar */}
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${(totalCount / 14) * 100}%` }} />
            </div>

            {/* Day Headers */}
            <div className="days-header">
              {data.days.map(day => (
                <div className={`day-col ${day.is_today ? 'today' : ''}`} key={day.date}>
                  <span className="day-label">{day.day_name}</span>
                  <span className="day-number">{day.day_num}</span>
                </div>
              ))}
            </div>

            {/* Quran Row */}
            <div className="tracker-row">
              <div className="tracker-label">
                <span className="tracker-icon quran-icon">Q</span>
                <span className="tracker-text">Kur&apos;an</span>
                <span className="tracker-count">{quranCount}/7</span>
              </div>
              <div className="tracker-cells">
                {data.days.map(day => {
                  const checked = user.entries[day.date]?.quran || false
                  return (
                    <div className="tracker-cell" key={day.date}>
                      <button
                        className={`check-btn ${checked ? 'checked' : ''} ${day.is_today ? 'today' : ''}`}
                        onClick={() => handleToggle(user.id, day.date, 'quran')}
                        aria-label={`${day.day_name} Kur'an`}
                      >
                        {checked && <CheckIcon />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hadith Row */}
            <div className="tracker-row">
              <div className="tracker-label">
                <span className="tracker-icon hadith-icon">H</span>
                <span className="tracker-text">Hadis</span>
                <span className="tracker-count">{hadithCount}/7</span>
              </div>
              <div className="tracker-cells">
                {data.days.map(day => {
                  const checked = user.entries[day.date]?.hadith || false
                  return (
                    <div className="tracker-cell" key={day.date}>
                      <button
                        className={`check-btn ${checked ? 'checked' : ''} ${day.is_today ? 'today' : ''}`}
                        onClick={() => handleToggle(user.id, day.date, 'hadith')}
                        aria-label={`${day.day_name} Hadis`}
                      >
                        {checked && <CheckIcon />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
      </div>
    </div>
  )
}

export default App
