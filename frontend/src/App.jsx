import { useState, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchWeek = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/week?week_offset=${weekOffset}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [weekOffset])

  useEffect(() => {
    fetchWeek()
  }, [fetchWeek])

  const handleToggle = async (userId, date, field) => {
    setData(prev => {
      const updated = { ...prev }
      updated.users = prev.users.map(u => {
        if (u.id !== userId) return u
        const entries = { ...u.entries }
        const current = entries[date] || { quran: false, hadith: false }
        entries[date] = { ...current, [field]: !current[field] }
        return { ...u, entries }
      })
      return updated
    })

    await fetch('/api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date, field }),
    })
  }

  if (loading || !data) {
    return (
      <div className="container">
        <div className="header">
          <div className="bismillah">{'\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650'}</div>
          <h1>Deen Tracker</h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Y&uuml;kleniyor...</p>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <div className="bismillah">{'\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650'}</div>
        <h1>Deen Tracker</h1>
      </div>

      <div className="week-nav">
        <button className="nav-btn" onClick={() => setWeekOffset(w => w - 1)}>{'\u2039'}</button>
        <span className="month-label">{data.month_label}</span>
        <button className="nav-btn" onClick={() => setWeekOffset(w => w + 1)}>{'\u203A'}</button>
      </div>

      {data.users.map(user => {
        const quranCount = data.days.filter(d => user.entries[d.date]?.quran).length
        const hadithCount = data.days.filter(d => user.entries[d.date]?.hadith).length

        return (
          <div className="user-section" key={user.id}>
            <div className="user-name">
              <span className="icon">{'\uD83D\uDC64'}</span>
              {user.name}
              <span className="user-stats">{quranCount + hadithCount}/14</span>
            </div>

            <div className="week-grid">
              <div className="week-grid-header">
                <div className="label-cell" />
                {data.days.map(day => (
                  <div className={`day-header ${day.is_today ? 'is-today' : ''}`} key={day.date}>
                    <span className="day-name">{day.day_name}</span>
                    <span className="day-num">{day.day_num}</span>
                  </div>
                ))}
              </div>

              <div className="entry-row">
                <div className="row-label">
                  <span className="emoji">{'\uD83D\uDCD6'}</span> Kur&apos;an
                </div>
                {data.days.map(day => {
                  const checked = user.entries[day.date]?.quran || false
                  return (
                    <div className="cell" key={day.date}>
                      <button
                        className={`toggle-btn ${checked ? 'checked' : ''}`}
                        onClick={() => handleToggle(user.id, day.date, 'quran')}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="entry-row">
                <div className="row-label">
                  <span className="emoji">{'\uD83D\uDCDC'}</span> Hadis
                </div>
                {data.days.map(day => {
                  const checked = user.entries[day.date]?.hadith || false
                  return (
                    <div className="cell" key={day.date}>
                      <button
                        className={`toggle-btn ${checked ? 'checked' : ''}`}
                        onClick={() => handleToggle(user.id, day.date, 'hadith')}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      <div className="stats">
        {data.users.map(user => {
          const quranCount = data.days.filter(d => user.entries[d.date]?.quran).length
          const hadithCount = data.days.filter(d => user.entries[d.date]?.hadith).length
          return (
            <div className="stats-group" key={user.id}>
              <div className="stat">
                <div className="stat-value">{quranCount}/7</div>
                <div className="stat-label">{user.name} - Kur&apos;an</div>
              </div>
              <div className="stat">
                <div className="stat-value">{hadithCount}/7</div>
                <div className="stat-label">{user.name} - Hadis</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="footer">
        Deen Tracker &middot; Hay&#305;rl&#305; g&uuml;nler {'\uD83E\uDD32'}
      </div>
    </div>
  )
}

export default App
