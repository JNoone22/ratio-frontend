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
  const [activePage, setActivePage] = useState('bigboard') // 'bigboard' or 'grid'
  const [gridType, setGridType] = useState('mag7') // 'mag7', 'indices', 'crypto'
  const [gridMatchups, setGridMatchups] = useState(null)

  useEffect(() => {
    fetchAssets()
  }, [])

  useEffect(() => {
    if (activePage === 'grid') {
      fetchGridMatchups()
    }
  }, [activePage, gridType])

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

  const fetchGridMatchups = async () => {
    try {
      console.log(`Fetching grid: ${API_BASE}/grid/${gridType}`)
      const response = await fetch(`${API_BASE}/grid/${gridType}`)
      
      if (!response.ok) {
        console.error(`Grid fetch failed: ${response.status}`)
        setGridMatchups(null)
        return
      }
      
      const data = await response.json()
      console.log('Grid data received:', data)
      
      if (!data || !data.matchups) {
        console.error('Invalid grid data:', data)
        setGridMatchups(null)
        return
      }
      
      setGridMatchups(data)
    } catch (error) {
      console.error('Failed to fetch grid matchups:', error)
      setGridMatchups(null)
    }
  }

  const getChangeColor = (value) => {
    if (value > 0) return 'var(--accent-green)'
    if (value < 0) return 'var(--accent-red)'
    return 'var(--text-secondary)'
  }

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.symbol.toLowerCase().includes(search.toLowerCase())
    // Backend returns 'stock', 'etf', 'crypto' (singular)
    // But filter tabs use 'stocks', 'etfs', 'crypto' (plural for first two)
    const normalizedType = asset.type === 'stock' ? 'stocks' : asset.type === 'etf' ? 'etfs' : asset.type
    const matchesFilter = filter === 'all' || normalizedType === filter
    return matchesSearch && matchesFilter
  })

  // Grid symbols
  const mag7Symbols = ['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA']
  const indicesSymbols = ['SPY', 'QQQ', 'DIA', 'GLD', 'SLV', 'IBIT', 'ETHA']
  const cryptoSymbols = ['BTC', 'ETH']
  
  // Display name mapping for prettier labels
  const symbolDisplayNames = {
    'GLD': 'GOLD',
    'SLV': 'SILVER',
    'IBIT': 'BIT',
    'ETHA': 'ETH'
  }
  
  const getDisplayName = (symbol) => symbolDisplayNames[symbol] || symbol

  const getGridSymbols = () => {
    if (gridType === 'mag7') return mag7Symbols
    if (gridType === 'indices') return indicesSymbols
    if (gridType === 'crypto') return cryptoSymbols
    return mag7Symbols
  }

  const getGridAssets = () => {
    const symbols = getGridSymbols()
    return assets.filter(asset => symbols.includes(asset.symbol))
  }

  const calculateHeadToHead = (asset1, asset2) => {
    // Both assets need price history for synthetic pair calculation
    // For now, we'll use the simpler approach: compare % above MA
    // TODO: Backend should provide synthetic pair data for true head-to-head
    
    // Winner is whoever is stronger relative to their own MA
    if (asset1.percent_above_ma > asset2.percent_above_ma) return 'W'
    if (asset1.percent_above_ma < asset2.percent_above_ma) return 'L'
    return 'T'
  }

  const getWinLossRecord = (symbol) => {
    if (gridMatchups && gridMatchups.matchups[symbol]) {
      const matchups = gridMatchups.matchups[symbol]
      let wins = 0
      let losses = 0
      
      Object.values(matchups).forEach(matchup => {
        // Skip null/undefined matchups
        if (!matchup) return
        
        // Handle object format {result: 'W', percent: X}
        const result = typeof matchup === 'object' && matchup.result ? matchup.result : matchup
        
        // Skip if result is still invalid
        if (!result || result === 'null' || result === 'undefined') return
        
        if (result === 'W') wins++
        if (result === 'L') losses++
      })
      
      const total = wins + losses
      const winRate = total > 0 ? (wins / total) * 100 : 0
      
      return { wins, losses, winRate }
    }
    
    return { wins: 0, losses: 0, winRate: 0 }
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
            <h1 className="logo">FRONTRUNNER</h1>
            <div className="tagline">See which assets are leading - instantly</div>
          </div>
          <div className="header-nav">
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#about" className="nav-link">ABOUT</a>
            <a href="#partners" className="nav-link">PARTNERS</a>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Page Toggle - Segmented Control */}
        <div className="page-toggle">
          <button 
            className={`page-toggle-btn ${activePage === 'bigboard' ? 'active' : ''}`}
            onClick={() => setActivePage('bigboard')}
          >
            THE BIG BOARD
          </button>
          <button 
            className={`page-toggle-btn ${activePage === 'grid' ? 'active' : ''}`}
            onClick={() => setActivePage('grid')}
          >
            THE GRID
          </button>
        </div>

        {/* Big Board View */}
        {activePage === 'bigboard' && (
          <>
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
        {activePage === 'grid' && (
          <>
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
                <button
                  className={`filter-tab ${gridType === 'mag7' ? 'active' : ''}`}
                  onClick={() => setGridType('mag7')}
                >
                  MAG7
                </button>
                <button
                  className={`filter-tab ${gridType === 'indices' ? 'active' : ''}`}
                  onClick={() => setGridType('indices')}
                >
                  INDICES
                </button>
                <button
                  className={`filter-tab ${gridType === 'crypto' ? 'active' : ''}`}
                  onClick={() => setGridType('crypto')}
                >
                  CRYPTO
                </button>
              </div>
            </div>

            <div className="grid-container">
              {!gridMatchups ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Loading grid...</div>
                </div>
              ) : (
                <>
                  {/* Grid Stats Summary */}
                  <div className="grid-stats-summary">
                    {gridMatchups.symbols.map(symbol => {
                      const record = getWinLossRecord(symbol)
                      return (
                        <div key={symbol} className="grid-stat">
                          <span className="grid-stat-symbol">{getDisplayName(symbol)}</span>
                          <span className="grid-stat-record">
                            {record.wins}-{record.losses}
                          </span>
                          <span className="grid-stat-pct">
                            ({record.winRate.toFixed(0)}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="matchup-grid">
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th></th>
                          {gridMatchups.symbols.map(symbol => (
                            <th key={symbol}>{getDisplayName(symbol)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gridMatchups.symbols.map((rowSymbol) => {
                          return (
                            <tr key={rowSymbol}>
                              <td className="grid-row-label">{getDisplayName(rowSymbol)}</td>
                              {gridMatchups.symbols.map(colSymbol => {
                                // TRANSPOSED: Show column's performance against row
                                // This way people read DOWN the column to see how that asset did
                                const colMatchups = gridMatchups.matchups[colSymbol]
                                if (!colMatchups) return <td key={colSymbol} className="grid-cell-self">-</td>
                                
                                const matchup = colMatchups[rowSymbol]
                                
                                // Handle self-matchup or missing data
                                if (!matchup || matchup === '-' || rowSymbol === colSymbol) {
                                  return <td key={colSymbol} className="grid-cell-self">-</td>
                                }
                                
                                // Handle N/A (insufficient data)
                                if (matchup === 'N/A') {
                                  return <td key={colSymbol} className="grid-cell-self">N/A</td>
                                }
                                
                                // Extract result (W/L/T) and percentage
                                const result = typeof matchup === 'object' && matchup.result ? matchup.result : matchup
                                const percent = typeof matchup === 'object' && matchup.percent ? matchup.percent : null
                                
                                // Extra safety check - if result is still null/undefined, show error
                                if (!result || result === 'null' || result === 'undefined') {
                                  console.error(`Invalid matchup result for ${rowSymbol} vs ${colSymbol}:`, matchup)
                                  return <td key={colSymbol} className="grid-cell-self">ERR</td>
                                }
                                
                                return (
                                  <td 
                                    key={colSymbol} 
                                    className={`grid-cell grid-cell-${result.toLowerCase()}`}
                                    title={percent !== null ? `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%` : ''}
                                  >
                                    {result}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
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
