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
  const [modalType, setModalType] = useState('hourly') // 'hourly' or 'daily'

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
        const response = await fetch(`${GAS_URL}?action=getStats`)
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
                onClick={() => { setSelectedSite(site); setModalType('daily'); }}
                style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <span className="stat-label" style={{ fontSize: '0.7rem' }}>누적 방문자 🔍</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--primary-light)' }}>{data.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSite && (
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
                  {stats[selectedSite].hourly.map((count, hour) => {
                    const maxCount = Math.max(...stats[selectedSite].hourly, 1);
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
              <div className="daily-list">
                <div className="daily-list-header">
                  <span>날짜</span>
                  <span>방문자 수</span>
                </div>
                <div className="daily-list-body">
                  {stats[selectedSite].history.length > 0 ? (
                    stats[selectedSite].history.map((item, idx) => (
                      <div key={idx} className="daily-row">
                        <span className="date">{item.date}</span>
                        <span className="count">{item.count.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>기록된 데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer style={{ marginTop: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
        &copy; 2026 통합 방문자 통계 &bull; Google Apps Script 연동
      </footer>
    </div>
  )
}

export default App
