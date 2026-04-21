import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [stats, setStats] = useState({
    'pecha.life': { live: 0, total: 0 },
    '119pecha.life': { live: 0, total: 0 },
    'pecha.shop': { live: 0, total: 0 }
  })

  const [loading, setLoading] = useState(true)

  // Simulation for live preview (Replace with real GAS URL later)
  useEffect(() => {
    // Instructions: Set your GAS Web App URL here
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxKeICtnye1vJVbNuJjx7wCwH3pIxnt2ELJaIXzS0SCxF44kMNdyIx4qNjvj5CWhKlv/exec";

    const fetchData = async () => {
      if (!GAS_URL) {
        // Fallback to simulation if no URL is provided
        setStats(prev => ({
          'pecha.life': {
            live: Math.floor(Math.random() * 5) + 1,
            total: prev['pecha.life'].total + Math.floor(Math.random() * 2)
          },
          '119pecha.life': {
            live: Math.floor(Math.random() * 3) + 1,
            total: prev['119pecha.life'].total + Math.floor(Math.random() * 2)
          },
          'pecha.shop': {
            live: Math.floor(Math.random() * 8) + 2,
            total: prev['pecha.shop'].total + Math.floor(Math.random() * 3)
          }
        }))
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

  const totalLive = Object.values(stats).reduce((acc, curr) => acc + curr.live, 0)

  return (
    <div className="dashboard-container">
      <header>
        <h1 className="gradient-text">Live Visitor Dashboard</h1>
        <p>Real-time monitoring across 3 active platforms</p>
      </header>

      <div className="main-stat glass-card" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div className="stat-label">Total Live Visitors</div>
        <div className="stat-value gradient-text" style={{ fontSize: '4rem' }}>{totalLive}</div>
        <div style={{ color: 'var(--success)' }}>
          <span className="status-dot"></span>
          System Online
        </div>
      </div>

      <div className="grid-layout">
        {Object.entries(stats).map(([site, data]) => (
          <div key={site} className="glass-card">
            <div className="stat-label">{site}</div>
            <div className="stat-value">{data.live}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Current active sessions
            </p>
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="stat-label" style={{ fontSize: '0.7rem' }}>Today's Total</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{data.total}</div>
            </div>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: '4rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
        &copy; 2026 PechaMaster Stats &bull; Powered by Google Apps Script
      </footer>
    </div>
  )
}

export default App
