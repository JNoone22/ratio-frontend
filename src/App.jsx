import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'https://web-production-d425.up.railway.app/api'

function App() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/big-board`)
      const data = await response.json()
      setAssets(data.rankings || [])
      setLastUpdate(data.last_update)
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAssets = assets.filter(asset => {
    // Search filter
    if (search && !asset.symbol.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    
    // Type filter
    if (filter === 'all') return true
    if (filter === 'stocks') return asset.type === 'stock'
    if (filter === 'etfs') return asset.type === 'etf'
    if (filter === 'crypto') return asset.type === 'crypto'
    
    return true
  })

  const getChangeColor = (percent) => {
    if (percent > 10) return 'var(--accent-green)'
    if (percent > 0) return '#00ff8844'
    if (percent < -10) return 'var(--accent-red)'
    if (percent < 0) return '#ff446644'
    return 'var(--text-dim)'
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading rankings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="logo">RATIO</h1>
            <div className="tagline">Asset Strength Rankings</div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Assets</div>
              <div className="stat-value">{assets.length}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Last Update</div>
              <div className="stat-value">
                {lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="controls">
          <div className="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-tabs">
            {['all', 'stocks', 'etfs', 'crypto'].map(tab => (
              <button
                key={tab}
                className={`filter-tab ${filter === tab ? 'active' : ''}`}
                onClick={() => setFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="big-board">
          <div className="board-header">
            <div className="col-rank">Rank</div>
            <div className="col-symbol">Symbol</div>
            <div className="col-wins">Record</div>
            <div className="col-win-rate">Win %</div>
            <div className="col-ma">% Above MA</div>
            <div className="col-status">Status</div>
          </div>

          <div className="board-body">
            {filteredAssets.map((asset, index) => (
              <div
                key={asset.symbol}
                className="board-row animate-fade-in"
                style={{ animationDelay: `${index * 0.02}s` }}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="col-rank">
                  <span className={`rank-badge ${asset.rank <= 10 ? 'top-rank' : ''}`}>
                    #{asset.rank}
                  </span>
                </div>
                <div className="col-symbol">
                  <span className="symbol-text">{asset.symbol}</span>
                </div>
                <div className="col-wins">
                  <span className="wins-text">
                    {asset.wins}-{asset.losses}
                  </span>
                </div>
                <div className="col-win-rate">
                  <span className="win-rate">{asset.win_rate.toFixed(1)}%</span>
                </div>
                <div className="col-ma">
                  <span
                    className="ma-value"
                    style={{ color: getChangeColor(asset.percent_above_ma) }}
                  >
                    {asset.percent_above_ma > 0 ? '+' : ''}
                    {asset.percent_above_ma.toFixed(2)}%
                  </span>
                </div>
                <div className="col-status">
                  <div className={`status-indicator ${asset.above_ma ? 'bull' : 'bear'}`}>
                    {asset.above_ma ? '▲' : '▼'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {selectedAsset && (
        <div className="modal-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAsset(null)}>×</button>
            <div className="modal-header">
              <div>
                <h2 className="modal-symbol">{selectedAsset.symbol}</h2>
                {selectedAsset.name && <div className="modal-name">{selectedAsset.name}</div>}
              </div>
              <div className={`modal-rank ${selectedAsset.rank <= 10 ? 'top-rank' : ''}`}>
                Rank #{selectedAsset.rank}
              </div>
            </div>
            <div className="modal-stats">
              <div className="modal-stat">
                <div className="modal-stat-label">Tournament Record</div>
                <div className="modal-stat-value">
                  {selectedAsset.wins}-{selectedAsset.losses}
                </div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-label">Win Rate</div>
                <div className="modal-stat-value">{selectedAsset.win_rate.toFixed(1)}%</div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-label">% Above 20W MA</div>
                <div
                  className="modal-stat-value"
                  style={{ color: getChangeColor(selectedAsset.percent_above_ma) }}
                >
                  {selectedAsset.percent_above_ma > 0 ? '+' : ''}
                  {selectedAsset.percent_above_ma.toFixed(2)}%
                </div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-label">Current Price</div>
                <div className="modal-stat-value">${selectedAsset.current_price.toFixed(2)}</div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-label">20W MA</div>
                <div className="modal-stat-value">${selectedAsset.ma.toFixed(2)}</div>
              </div>
              <div className="modal-stat">
                <div className="modal-stat-label">Status</div>
                <div className="modal-stat-value">
                  <span className={selectedAsset.above_ma ? 'status-bull' : 'status-bear'}>
                    {selectedAsset.above_ma ? '▲ Above MA' : '▼ Below MA'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer-text">
          Tournament rankings using synthetic pair ratios vs 20-week moving averages
        </div>
      </footer>
    </div>
  )
}

export default App
