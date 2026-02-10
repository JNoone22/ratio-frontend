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
  const [view, setView] = useState('bigboard') // 'bigboard' or 'grid'
  const [gridType, setGridType] = useState('mag7') // 'mag7' or 'indices'

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

  const getChangeColor = (value) => {
    if (value > 0) return 'var(--accent-green)'
    if (value < 0) return 'var(--accent-red)'
    return 'var(--text-secondary)'
  }

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.symbol.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || asset.type === filter
    return matchesSearch && matchesFilter
  })

  // Grid symbols
  const mag7Symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META']
  const indicesSymbols = ['SPY', 'QQQ', 'DIA', 'GLD', 'SLV', 'IBIT', 'ETHA']

  const getGridSymbols = () => {
    return gridType === 'mag7' ? mag7Symbols : indicesSymbols
  }

  const getGridAssets = () => {
    const symbols = getGridSymbols()
    return assets.filter(asset => symbols.includes(asset.symbol))
  }

  const calculateHeadToHead = (asset1, asset2) => {
    // Asset with higher % above MA wins
    if (asset1.percent_above_ma > asset2.percent_above_ma) return 'W'
    if (asset1.percent_above_ma < asset2.percent_above_ma) return 'L'
    return 'T'
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
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
            <h1 className="logo">FRONT RUNNER</h1>
            <div className="tagline">See who's leading the market right now</div>
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
        {/* View Selector Dropdowns */}
        <div className="view-selector">
          <select 
            className="view-dropdown"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="bigboard">BIG BOARD</option>
          </select>

          <select 
            className="view-dropdown"
            value={view === 'grid' ? gridType : ''}
            onChange={(e) => {
              setView('grid')
              setGridType(e.target.value)
            }}
          >
            <option value="" disabled>GRIDS</option>
            <option value="mag7">MAG7 Grid</option>
            <option value="indices">Major Indices Grid</option>
          </select>
        </div>

        {/* Big Board View */}
        {view === 'bigboard' && (
          <>
            <div className="section-description">
              Quickly identify market leaders. Rankings update based on which assets are 
              performing strongest relative to their 20-week moving average.
            </div>

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
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="board-container">
              <div className="board-header">
                <div className="col-rank">Rank</div>
                <div className="col-symbol">Symbol</div>
                <div className="col-wins">
                  Record
                  <span className="info-icon" title="Wins-Losses in head-to-head matchups against all other assets">ⓘ</span>
                </div>
                <div className="col-win-rate">
                  Win %
                  <span className="info-icon" title="Percentage of matchups won (higher = stronger performance)">ⓘ</span>
                </div>
                <div className="col-ma">
                  % Above MA
                  <span className="info-icon" title="Current price vs 20-week moving average (+% = bullish, -% = bearish)">ⓘ</span>
                </div>
                <div className="col-status">Status</div>
              </div>

              {filteredAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="board-row"
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
          </>
        )}

        {/* Grid View */}
        {view === 'grid' && (
          <>
            <div className="section-description">
              {gridType === 'mag7' 
                ? 'Head-to-head matchups between the Magnificent 7 tech stocks'
                : 'Head-to-head matchups between major market indices and assets'
              }
            </div>

            <div className="grid-container">
              <h2 className="grid-title">
                {gridType === 'mag7' ? 'MAG7 Grid' : 'Major Indices Grid'}
              </h2>

              <div className="matchup-grid">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th></th>
                      {getGridSymbols().map(symbol => (
                        <th key={symbol}>{symbol}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getGridAssets().map((rowAsset) => (
                      <tr key={rowAsset.symbol}>
                        <td className="grid-row-label">{rowAsset.symbol}</td>
                        {getGridSymbols().map(colSymbol => {
                          const colAsset = assets.find(a => a.symbol === colSymbol)
                          if (!colAsset || rowAsset.symbol === colSymbol) {
                            return <td key={colSymbol} className="grid-cell-self">-</td>
                          }
                          const result = calculateHeadToHead(rowAsset, colAsset)
                          return (
                            <td 
                              key={colSymbol} 
                              className={`grid-cell grid-cell-${result.toLowerCase()}`}
                            >
                              {result}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
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
                    {selectedAsset.above_ma ? '▲ Bullish' : '▼ Bearish'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
