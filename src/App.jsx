import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [stats, setStats] = useState({
    'pecha.life': { live: 0, today: 0, total: 0, hourly: new Array(24).fill(0), history: [] },
    '119pecha.life': { live: 0, today: 0, total: 0, hourly: new Array(24).fill(0), history: [] },
    'pecha.shop': { live: 0, today: 0, total: 0, hourly: new Array(24).fill(0), history: [] },
    'pecha.cyou': { live: 0, today: 0, total: 0, hourly: new Array(24).fill(0), history: [] }
  })

  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState(null)
  const [modalType, setModalType] = useState('hourly') 
  const [calDate, setCalDate] = useState(new Date()) // 달력 기준 날짜

  // Simulation for live preview
  useEffect(() => {
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxKeICtnye1vJVbNuJjx7wCwH3pIxnt2ELJaIXzS0SCxF44kMNdyIx4qNjvj5CWhKlv/exec";

    const fetchData = async () => {
      if (!GAS_URL) {
        setStats(prev => {
          const newStats = { ...prev };
          Object.keys(newStats).forEach(site => {
            const added = Math.floor(Math.random() * 2);
            const currentHour = new Date().getUTCHours();
            const newHourly = [...(prev[site].hourly || new Array(24).fill(0))];
            newHourly[currentHour] += added;

            newStats[site] = {
              live: Math.floor(Math.random() * 5) + 1,
              today: prev[site].today + added,
              total: prev[site].total + added,
              hourly: newHourly,
              history: prev[site].history || []
            };
          });
          return newStats;
        })
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${GAS_URL}?action=getStats&t=${Date.now()}`)
        const data = await response.json()
        setStats(data)
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const totalLive = Object.values(stats).reduce((acc, curr) => acc + (curr.live || 0), 0)

  // 달력 렌더링 함수
  const renderCalendar = (history) => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // 공백 추가
    for (let i = 0; i < firstDay; i++) days.push(null);
    // 날짜 추가
    for (let i = 1; i <= lastDate; i++) days.push(i);

    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))}>&lt;</button>
          <span>{year}년 {month + 1}월</span>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))}>&gt;</button>
        </div>
        <div className="calendar-grid">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} className="calendar-day-label">{d}</div>)}
          {days.map((day, idx) => {
            if (!day) return <div key={idx} className="calendar-day empty"></div>;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const historyItem = history.find(h => h.date === dateStr);
            const count = historyItem ? historyItem.count : 0;

            return (
              <div key={idx} className={`calendar-day ${count > 0 ? 'has-data' : ''}`}>
                <span className="day-num">{day}</span>
                {count > 0 && <span className="day-count">{count.toLocaleString()}</span>}
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <header>
        <h1 className="gradient-text">실시간 방문자 대시보드</h1>
      </header>

      <div className="main-stat glass-card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div className="stat-label">총 실시간 접속자</div>
        <div className="stat-value gradient-text" style={{ fontSize: '3rem' }}>{totalLive}</div>
        <div style={{ color: 'var(--success)' }}>
          <span className="status-dot"></span>
          시스템 정상 가동 중
        </div>
      </div>

      <div className="grid-layout">
        {Object.entries(stats).map(([site, data]) => (
          <div key={site} className="glass-card">
            <div className="warning-text" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{site}</div>
            <div className="stat-value">{data.live}</div>
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div 
                className="clickable-stat"
                onClick={() => { setSelectedSite(site); setModalType('hourly'); }}
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', cursor: 'pointer' }}
              >
                <span className="stat-label" style={{ fontSize: '0.7rem' }}>오늘 방문자 🔍</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>{data.today}</span>
              </div>
              <div 
                className="clickable-stat"
                onClick={() => { setSelectedSite(site); setModalType('daily'); setCalDate(new Date()); }}
                style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <span className="stat-label" style={{ fontSize: '0.7rem' }}>누적 방문자 🔍</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--primary-light)' }}>{data.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSite && (() => {
        const data = stats[selectedSite];
        return (
          <div className="modal-overlay" onClick={() => setSelectedSite(null)}>
            <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="warning-text">
                  {selectedSite} {modalType === 'hourly' ? '시간별 통계' : '일별 통계'}
                </h2>
                <button className="close-btn" onClick={() => setSelectedSite(null)}>&times;</button>
              </div>
            
            {modalType === 'hourly' ? (
              <>
                <div className="hourly-chart">
                  {(data.hourly || new Array(24).fill(0)).map((count, hour) => {
                    const hourlyData = data.hourly || new Array(24).fill(0);
                    const maxCount = Math.max(...hourlyData, 1);
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={hour} className="chart-bar-container">
                        <div className="chart-bar" style={{ height: `${height}%` }}>
                          <span className="bar-tooltip">{count}</span>
                        </div>
                        <span className="bar-label">{hour}</span>
                      </div>
                    )
                  })}
                </div>
                <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  오늘 0시부터 현재까지의 시간대별 방문자 수입니다.
                </p>
              </>
            ) : (
              renderCalendar(data.history || [])
            )}
            </div>
          </div>
        );
      })()}

      <footer style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
        &copy; 2026 통합 방문자 통계 &bull; Google Apps Script 연동
      </footer>
    </div>
  )
}

export default App
