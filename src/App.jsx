import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'https://api.frontrunnerapp.site/api'

function App() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activePage, setActivePage] = useState('board') // 'board', 'grid', 'how-it-works', 'faq', 'partners'
  const [gridType, setGridType] = useState('mag7') // 'mag7', 'indices', 'crypto', 'forex', 'commodity', 'custom'
  const [gridMatchups, setGridMatchups] = useState(null)
  const [customGridAssets, setCustomGridAssets] = useState([])
  const [customGridSearch, setCustomGridSearch] = useState('')
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    fetchAssets()
    
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(iOS)
    
    // Show install prompt for iOS (they can't auto-install)
    if (iOS && !window.navigator.standalone) {
      setShowInstallPrompt(true)
    }
    
    // Capture the install prompt event (Android/Desktop)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    })
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('✅ User installed the app')
    }
    
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  useEffect(() => {
    if (activePage === 'grid') {
      if (gridType === 'custom' && customGridAssets.length >= 2) {
        // Calculate custom grid client-side - no backend call needed
        calculateCustomGrid()
      } else if (gridType !== 'custom') {
        fetchGridMatchups()
      }
    }
  }, [activePage, gridType, customGridAssets])

  const calculateCustomGrid = () => {
    // Build matchups from custom assets client-side
    const symbols = customGridAssets.map(a => a.symbol)
    const matchups = {}
    
    symbols.forEach(sym1 => {
      matchups[sym1] = {}
      symbols.forEach(sym2 => {
        if (sym1 === sym2) {
          matchups[sym1][sym2] = '-'
        } else {
          const asset1 = customGridAssets.find(a => a.symbol === sym1)
          const asset2 = customGridAssets.find(a => a.symbol === sym2)
          
          if (asset1.above_ma && !asset2.above_ma) {
            matchups[sym1][sym2] = 'W'
          } else if (!asset1.above_ma && asset2.above_ma) {
            matchups[sym1][sym2] = 'L'
          } else {
            matchups[sym1][sym2] = asset1.rank < asset2.rank ? 'W' : 'L'
          }
        }
      })
    })
    
    setGridMatchups({ symbols, matchups })
  }

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
    // Search filter - strict "starts with" matching
    const matchesSearch = !search || asset.symbol.toUpperCase().startsWith(search.toUpperCase())
    
    // Classify commodities (specific commodity trackers, not broad baskets like DBC)
    const commoditySymbols = ['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB', 'CPER', 'PPLT', 'PALL', 'UGA', 'URNM', 'SIL', 'GDX', 'URA', 'COPX', 'SRUU']
    const isCommodity = commoditySymbols.includes(asset.symbol)
    
    // S&P 500 flag comes from backend
    const isSP500 = asset.sp500 === true
    
    // Special handling for EMA8 filter - show ONLY assets above EMA8
    // NOTE: EMA8 tab removed from UI but filter logic preserved for future use
    if (filter === 'ema8') {
      // Direct comparison: current price must be greater than 8W EMA
      const passesFilter = asset.ema8 && asset.current_price && asset.current_price > asset.ema8
      return matchesSearch && passesFilter
    }
    
    // Special handling for BREAKOUT filter - show ONLY assets with exactly 1 trend week
    if (filter === 'breakout') {
      return matchesSearch && asset.weeks_trending === 1
    }
    
    // Determine asset type for filtering
    let assetType
    if (filter === 'sp500' && isSP500) {
      assetType = 'sp500'
    } else if (isCommodity) {
      assetType = 'commodity'
    } else if (asset.type === 'forex') {
      assetType = 'forex'
    } else if (asset.type === 'stock') {
      assetType = 'stocks'
    } else if (asset.type === 'etf') {
      assetType = 'etfs'
    } else if (asset.type === 'crypto') {
      assetType = 'crypto'
    } else {
      assetType = 'other'  // Fallback
    }
    
    const matchesFilter = filter === 'all' || assetType === filter
    return matchesSearch && matchesFilter
  })
  
  // Re-rank assets within the current filter
  // On ALL tab: use global rank
  // On type-specific tabs: rank #1, #2, #3 within that type
  const rankedAssets = filter === 'all' 
    ? filteredAssets
    : filteredAssets.map((asset, index) => ({
        ...asset,
        displayRank: index + 1  // Re-rank: #1 in ETFs, #1 in Stocks, etc.
      }))

  // Grid symbols
  const mag7Symbols = ['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA']
  const indicesSymbols = ['SPY', 'QQQ', 'DIA', 'GLD', 'SLV', 'IBIT', 'ETHA']
  const commoditySymbols = ['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB']
  const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'HYPE', 'XRP', 'DOGE']
  const forexSymbols = ['USD', 'EUR', 'JPY', 'CAD', 'AUD', 'GBP', 'CHF']
  
  // Display name mapping for prettier labels
  const symbolDisplayNames = {
    'GOOGL': 'GOOG',
    'DIA': 'DJI',
    'USO': 'OIL',
    'UNG': 'GAS',
    'WEAT': 'WHEAT',
    'IBIT': 'BTC',
    'ETHA': 'ETH'
  }
  
  const getDisplayName = (symbol) => symbolDisplayNames[symbol] || symbol

  const getGridSymbols = () => {
    if (gridType === 'mag7') return mag7Symbols
    if (gridType === 'indices') return indicesSymbols
    if (gridType === 'commodity') return commoditySymbols
    if (gridType === 'crypto') return cryptoSymbols
    if (gridType === 'forex') return forexSymbols
    if (gridType === 'custom') return customGridAssets.map(a => a.symbol)
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
            <div className="tagline">The Market Rewards Strength</div>
          </div>
          <div className="header-nav">
            <span onClick={() => setActivePage('how-it-works')} className="nav-link" style={{cursor: 'pointer'}}>HOW IT WORKS</span>
            <span onClick={() => setActivePage('faq')} className="nav-link" style={{cursor: 'pointer'}}>FAQ</span>
            <span onClick={() => setActivePage('partners')} className="nav-link" style={{cursor: 'pointer'}}>PARTNERS</span>
          </div>
        </div>
      </header>

      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="install-banner">
          <div className="install-content">
            <span className="install-icon">📱</span>
            <div className="install-text">
              <strong>Download Front Runner</strong>
              {isIOS ? (
                <span>Tap Share <svg style={{display: 'inline', width: '14px', height: '14px', verticalAlign: 'middle'}} viewBox="0 0 50 50"><path fill="currentColor" d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z"/><path fill="currentColor" d="M24 7h2v21h-2z"/><path fill="currentColor" d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z"/></svg> then "Add to Home Screen"</span>
              ) : (
                <span>Add to home screen for faster access</span>
              )}
            </div>
          </div>
          <div className="install-actions">
            {!isIOS && (
              <button onClick={handleInstallClick} className="install-button">
                Download
              </button>
            )}
            <button onClick={() => setShowInstallPrompt(false)} className="dismiss-button">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="main">
        {/* Page Toggle - Segmented Control */}
        <div className="page-toggle">
          <button 
            className={`page-toggle-btn ${activePage === 'board' ? 'active' : ''}`}
            onClick={() => setActivePage('board')}
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
        {activePage === 'board' && (
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
                {['all', 'sp500', 'etfs', 'commodity', 'crypto', 'breakout'].map(tab => (
                  <button
                    key={tab}
                    className={`filter-tab ${filter === tab ? 'active' : ''}`}
                    onClick={() => setFilter(tab)}
                  >
                    {tab === 'sp500' ? 'S&P 500' : tab === 'commodity' ? 'COMMODITY' : tab === 'breakout' ? 'BREAKOUT' : tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="board-container" key={filter}>
              <div className="board-header">
                <div className="col-rank">Rank</div>
                <div className="col-symbol">Symbol</div>
                <div className="col-type">Type</div>
                <div className="col-win-rate">
                  Win %
                  <span className="info-icon" data-tooltip="Percentage of matchups won (higher = stronger performance)">ⓘ</span>
                </div>
                <div className="col-weeks">Trend Weeks</div>
                <div className="col-status">Status</div>
              </div>

              {rankedAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  className="board-row"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="col-rank">
                    <span className={`rank-badge ${(asset.displayRank || asset.rank) === 1 ? 'rank-one' : (asset.displayRank || asset.rank) <= 10 ? 'top-rank' : ''}`}>
                      #{asset.displayRank || asset.rank}
                    </span>
                  </div>
                  <div className="col-symbol">
                    <span className="symbol-text">{asset.symbol}</span>
                  </div>
                  <div className="col-type">
                    <span className="type-badge">
                      {['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB', 'CPER', 'PPLT', 'PALL', 'UGA', 'URNM', 'SIL', 'GDX', 'URA', 'COPX', 'SRUU'].includes(asset.symbol) 
                        ? 'Commodity' 
                        : asset.type === 'stock' ? 'Stock' : asset.type === 'etf' ? 'ETF' : 'Crypto'}
                    </span>
                  </div>
                  <div className="col-win-rate">
                    <span className="win-rate">{asset.win_rate.toFixed(1)}%</span>
                  </div>
                  <div className="col-weeks">
                    <span className="weeks-value">{asset.weeks_trending || 0}</span>
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
                <button
                  className={`filter-tab ${gridType === 'forex' ? 'active' : ''}`}
                  onClick={() => setGridType('forex')}
                >
                  FOREX
                </button>
                <button
                  className={`filter-tab ${gridType === 'custom' ? 'active' : ''}`}
                  onClick={() => setGridType('custom')}
                >
                  CUSTOM
                </button>
              </div>
            </div>

            {/* Custom Grid Builder */}
            {gridType === 'custom' && (
              <div className="custom-grid-builder">
                <div className="custom-grid-header">
                  <h3>Build Your Custom Grid</h3>
                  <p>Select up to 7 assets to compare head-to-head</p>
                </div>
                
                <div className="custom-grid-search">
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={customGridSearch}
                    onChange={(e) => setCustomGridSearch(e.target.value)}
                    className="custom-grid-search-input"
                  />
                  {customGridSearch && (
                    <div className="custom-grid-dropdown">
                      {assets
                        .filter(a => 
                          a.symbol.toLowerCase().includes(customGridSearch.toLowerCase()) ||
                          (a.name && a.name.toLowerCase().includes(customGridSearch.toLowerCase()))
                        )
                        .filter(a => !customGridAssets.find(ca => ca.symbol === a.symbol))
                        .slice(0, 20)
                        .map(asset => (
                          <div
                            key={asset.symbol}
                            className="custom-grid-dropdown-item"
                            onClick={() => {
                              if (customGridAssets.length < 7) {
                                setCustomGridAssets([...customGridAssets, asset])
                                setCustomGridSearch('')
                              }
                            }}
                          >
                            <span className="dropdown-symbol">{asset.symbol}</span>
                            <span className="dropdown-name">{asset.name}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="custom-grid-selected">
                  {customGridAssets.map(asset => (
                    <div key={asset.symbol} className="custom-grid-chip">
                      <span>{asset.symbol}</span>
                      <button
                        onClick={() => setCustomGridAssets(customGridAssets.filter(a => a.symbol !== asset.symbol))}
                        className="chip-remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {customGridAssets.length === 0 && (
                    <div className="custom-grid-empty">No assets selected yet</div>
                  )}
                </div>

                <div className="custom-grid-info">
                  {customGridAssets.length}/7 assets selected
                  {customGridAssets.length >= 2 && customGridAssets.length <= 7 && (
                    <span className="ready-indicator">✓ Ready to generate grid</span>
                  )}
                </div>
              </div>
            )}

            <div className="grid-container">
              {gridType === 'custom' && customGridAssets.length < 2 ? (
                <div className="custom-grid-prompt">
                  <div className="prompt-icon">⚔️</div>
                  <div className="prompt-text">Select at least 2 assets to generate a grid</div>
                </div>
              ) : !gridMatchups ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Loading grid...</div>
                </div>
              ) : (
                <>
                  {/* Grid Stats Summary */}
                  <div className="grid-stats-summary">
                    {gridMatchups.symbols
                      .map(symbol => ({
                        symbol,
                        record: getWinLossRecord(symbol)
                      }))
                      .sort((a, b) => b.record.wins - a.record.wins) // Sort by wins descending
                      .map(({ symbol, record }) => (
                        <div key={symbol} className="grid-stat">
                          <span className="grid-stat-symbol">{getDisplayName(symbol)}</span>
                          <span className="grid-stat-record">
                            {record.wins}-{record.losses}
                          </span>
                        </div>
                      ))
                    }
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

                  {/* Grid Explainer */}
                  <div className="grid-explainer">
                    <h3>How to Read The Grid</h3>
                    <p>
                      Each cell shows the winner of a head-to-head matchup. A <strong className="win-indicator">green W</strong> means the column asset (top) is above its 20W MA while the row asset (left) is below theirs—the column asset wins. A <strong className="loss-indicator">red L</strong> means the row asset wins. Assets with more wins are stronger.
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* HOW IT WORKS Page */}
      {activePage === 'how-it-works' && (
        <div style={{padding: '60px 20px', maxWidth: '800px', margin: '0 auto'}}>
          <p style={{fontSize: '24px', marginBottom: '40px', color: '#ccc', textAlign: 'center', lineHeight: '1.5', fontStyle: 'italic'}}>
            Markets aren't about what's going up — they're about what's winning.
          </p>
        
        <p style={{lineHeight: '1.8', color: '#ccc', marginBottom: '40px'}}>
          FrontRunner is built on a simple idea: markets reward relative strength. We rank every tradable asset head-to-head, making leadership visible so you can focus on what's winning.
        </p>

        <div style={{marginBottom: '40px'}}>
          <h2 style={{fontSize: '28px', marginBottom: '20px', color: '#00ff9d', fontWeight: '700'}}>How To Use FrontRunner</h2>
          
          <div style={{marginBottom: '30px'}}>
            <h3 style={{fontSize: '20px', marginBottom: '12px', fontWeight: '700', color: '#fff'}}>The Big Board</h3>
            <p style={{lineHeight: '1.8', color: '#ccc'}}>
              Easily view the assets that are leading the market right now. FrontRunner pits every relevant stock, ETF, commodity and crypto coin against each other in head-to-head matchups by creating synthetic pairs. No opinions, no predictions, just math. Every day, over 1.5 million of these synthetic pairs are created, and the tournament system calculates the win rate for each and every asset. The Big Board ranks them all - and the strongest rise to the top.
            </p>
          </div>

          <div style={{marginBottom: '30px'}}>
            <h3 style={{fontSize: '20px', marginBottom: '12px', fontWeight: '700', color: '#fff'}}>The Grid</h3>
            <p style={{lineHeight: '1.8', color: '#ccc'}}>
              Turn complex market data into a simple 7x7 head-to-head matchup table. Pick an asset on the top row, and follow that row down to view how that asset performs in each head-to-head matchup. <span style={{color: '#00ff9d', fontWeight: '600'}}>Green W's</span> means the asset at the top of that column is outperforming the asset to the far left in that specific row. <span style={{color: '#ef4444', fontWeight: '600'}}>Red L's</span> means the opposite, that the asset at the top of the column is being outperformed by the asset to the far left in that specific row. See exactly how the market's most important assets stack up, or build your own custom Grid to compare your favorites.
            </p>
          </div>
        </div>

        <div style={{marginBottom: '30px'}}>
          <h3 style={{fontSize: '20px', marginBottom: '12px', fontWeight: '700', color: '#fff'}}>TLDR</h3>
          <p style={{lineHeight: '1.8', color: '#ccc'}}>
            Start with The Big Board to see what's leading the market right now, with 1,700+ assets ranked daily by head-to-head strength. The "Trend Weeks" column shows momentum, and can help identify newly trending assets that have just recently flipped bullish. Head over to The Grid to compare market leaders head-to-head, or build a custom grid with the assets you're tracking. Click any asset to dive deeper into its full stats, tournament record, and current position relative to key moving averages.
          </p>
        </div>
      </div>
      )}

      {/* FAQ Page */}
      {activePage === 'faq' && (
        <div style={{padding: '60px 20px', maxWidth: '800px', margin: '0 auto'}}>
          <h1 style={{fontSize: '36px', marginBottom: '40px', color: '#00ff9d', textAlign: 'center'}}>Frequently Asked Questions</h1>
          <p style={{lineHeight: '1.8', color: '#ccc'}}>
            FAQ content coming soon...
          </p>
        </div>
      )}

      {/* PARTNERS Page */}
      {activePage === 'partners' && (
        <div style={{padding: '60px 20px', maxWidth: '800px', margin: '0 auto'}}>
          <h1 style={{fontSize: '36px', marginBottom: '20px', color: '#00ff9d', textAlign: 'center'}}>Partners</h1>
          <p style={{fontSize: '18px', marginBottom: '50px', color: '#ccc', textAlign: 'center', lineHeight: '1.6'}}>
            Tools to trade, analyze, and act on market leadership.
          </p>
          <p style={{lineHeight: '1.8', color: '#ccc', marginBottom: '50px', textAlign: 'center'}}>
            FrontRunner ranks strength across markets. These platforms help you execute on it.
          </p>

          {/* Brokerage Platforms */}
          <div style={{marginBottom: '50px'}}>
            <h2 style={{fontSize: '28px', marginBottom: '30px', color: '#00ff9d', fontWeight: '700'}}>Brokerage Platforms</h2>
            
            <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)'}}>
              <h3 style={{fontSize: '22px', marginBottom: '8px', fontWeight: '700', color: '#fff'}}>Fidelity Investments</h3>
              <p style={{fontSize: '14px', marginBottom: '12px', color: '#00ff9d', fontWeight: '600'}}>Best for: Long-term investors & ETF traders</p>
              <p style={{lineHeight: '1.6', color: '#ccc', marginBottom: '15px'}}>
                Commission-free stock & ETF trading with strong research tools and reliability.
              </p>
              <a href="https://www.fidelity.com" target="_blank" rel="noopener noreferrer" style={{color: '#00ff9d', textDecoration: 'none', fontWeight: '600'}}>
                → Open an account
              </a>
            </div>

            <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)'}}>
              <h3 style={{fontSize: '22px', marginBottom: '8px', fontWeight: '700', color: '#fff'}}>Interactive Brokers</h3>
              <p style={{fontSize: '14px', marginBottom: '12px', color: '#00ff9d', fontWeight: '600'}}>Best for: Active & global traders</p>
              <p style={{lineHeight: '1.6', color: '#ccc', marginBottom: '15px'}}>
                Access to global markets, advanced order routing, and professional-level tools.
              </p>
              <a href="https://www.interactivebrokers.com" target="_blank" rel="noopener noreferrer" style={{color: '#00ff9d', textDecoration: 'none', fontWeight: '600'}}>
                → Open an account
              </a>
            </div>
          </div>

          {/* Crypto Exchanges */}
          <div style={{marginBottom: '50px'}}>
            <h2 style={{fontSize: '28px', marginBottom: '30px', color: '#00ff9d', fontWeight: '700'}}>Crypto Exchanges</h2>
            
            <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)'}}>
              <h3 style={{fontSize: '22px', marginBottom: '8px', fontWeight: '700', color: '#fff'}}>Coinbase</h3>
              <p style={{fontSize: '14px', marginBottom: '12px', color: '#00ff9d', fontWeight: '600'}}>Best for: Simplicity & U.S.-based access</p>
              <p style={{lineHeight: '1.6', color: '#ccc', marginBottom: '15px'}}>
                Clean interface, strong compliance standards, and easy fiat onboarding.
              </p>
              <a href="https://www.coinbase.com" target="_blank" rel="noopener noreferrer" style={{color: '#00ff9d', textDecoration: 'none', fontWeight: '600'}}>
                → Open an account
              </a>
            </div>

            <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)'}}>
              <h3 style={{fontSize: '22px', marginBottom: '8px', fontWeight: '700', color: '#fff'}}>Kraken</h3>
              <p style={{fontSize: '14px', marginBottom: '12px', color: '#00ff9d', fontWeight: '600'}}>Best for: Lower fees & advanced traders</p>
              <p style={{lineHeight: '1.6', color: '#ccc', marginBottom: '15px'}}>
                Deep liquidity, margin access, and strong security track record.
              </p>
              <a href="https://www.kraken.com" target="_blank" rel="noopener noreferrer" style={{color: '#00ff9d', textDecoration: 'none', fontWeight: '600'}}>
                → Open an account
              </a>
            </div>
          </div>

          {/* Charting & Analysis */}
          <div style={{marginBottom: '50px'}}>
            <h2 style={{fontSize: '28px', marginBottom: '30px', color: '#00ff9d', fontWeight: '700'}}>Charting & Analysis</h2>
            
            <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 157, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 157, 0.2)'}}>
              <h3 style={{fontSize: '22px', marginBottom: '8px', fontWeight: '700', color: '#fff'}}>TradingView</h3>
              <p style={{fontSize: '14px', marginBottom: '12px', color: '#00ff9d', fontWeight: '600'}}>Best for: Charting & technical analysis</p>
              <p style={{lineHeight: '1.6', color: '#ccc', marginBottom: '15px'}}>
                Professional-grade charting, screening, and custom indicators.
              </p>
              <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer" style={{color: '#00ff9d', textDecoration: 'none', fontWeight: '600'}}>
                → Explore TradingView
              </a>
            </div>
          </div>

          {/* Our Favorite Analysts */}
          <div style={{marginBottom: '50px'}}>
            <h2 style={{fontSize: '28px', marginBottom: '30px', color: '#00ff9d', fontWeight: '700'}}>Our Favorite Analysts</h2>
            
            <div style={{marginBottom: '15px'}}>
              <h3 style={{fontSize: '18px', marginBottom: '4px', fontWeight: '700', color: '#fff'}}>Aksel Kibar</h3>
              <p style={{lineHeight: '1.6', color: '#ccc'}}>Classical Charting</p>
            </div>

            <div style={{marginBottom: '15px'}}>
              <h3 style={{fontSize: '18px', marginBottom: '4px', fontWeight: '700', color: '#fff'}}>Cheds Trading</h3>
              <p style={{lineHeight: '1.6', color: '#ccc'}}>Classical Charting, Technical Analysis and Bitcoin Expert</p>
            </div>

            <div style={{marginBottom: '15px'}}>
              <h3 style={{fontSize: '18px', marginBottom: '4px', fontWeight: '700', color: '#fff'}}>The Chart Guys</h3>
              <p style={{lineHeight: '1.6', color: '#ccc'}}>Charting & technical analysis expert</p>
            </div>

            <div style={{marginBottom: '15px'}}>
              <h3 style={{fontSize: '18px', marginBottom: '4px', fontWeight: '700', color: '#fff'}}>Brian Shannon</h3>
              <p style={{lineHeight: '1.6', color: '#ccc'}}>Anchored VWAP</p>
            </div>

            <div style={{marginBottom: '15px'}}>
              <h3 style={{fontSize: '18px', marginBottom: '4px', fontWeight: '700', color: '#fff'}}>Bob Loukas</h3>
              <p style={{lineHeight: '1.6', color: '#ccc'}}>Long Term Technical Analysis, 4 Year Cycle Expert</p>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{marginTop: '60px', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)'}}>
            <p style={{lineHeight: '1.8', color: '#ccc', fontSize: '14px'}}>
              FrontRunner provides market rankings and analysis for informational purposes only. Nothing on this site constitutes investment advice. Our rankings are never influenced by partnerships. Always conduct your own research before making financial decisions. We rank markets objectively. You choose how to act.
            </p>
          </div>
        </div>
      )}

      {selectedAsset && (
        <div className="modal-overlay" onClick={() => setSelectedAsset(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAsset(null)}>×</button>
            <div className="modal-header">
              <div>
                <h2 className="modal-symbol">{selectedAsset.symbol}</h2>
                {selectedAsset.name && <div className="modal-name">{selectedAsset.name}</div>}
              </div>
              <div className={`modal-rank ${(selectedAsset.displayRank || selectedAsset.rank) === 1 ? 'rank-one' : (selectedAsset.displayRank || selectedAsset.rank) <= 10 ? 'top-rank' : ''}`}>
                Rank #{selectedAsset.displayRank || selectedAsset.rank}
                {selectedAsset.displayRank && (
                  <span style={{ fontSize: '11px', marginLeft: '8px', opacity: 0.6 }}>
                    (#{selectedAsset.rank} overall)
                  </span>
                )}
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
                <div className="modal-stat-label">8W EMA</div>
                <div className="modal-stat-value">${selectedAsset.ema8?.toFixed(2) || 'N/A'}</div>
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

      {/* Footer */}
      <footer style={{
        marginTop: '80px',
        padding: '60px 20px 30px',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0, 255, 157, 0.03) 100%)',
        borderTop: '1px solid rgba(0, 255, 157, 0.1)'
      }}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          {/* Footer Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '40px',
            marginBottom: '50px'
          }}>
            
            {/* Brand Column */}
            <div>
              <h3 style={{
                fontSize: '28px',
                color: '#00ff9d',
                marginBottom: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '700'
              }}>FRONTRUNNER</h3>
              <p style={{
                fontSize: '13px',
                color: '#888',
                lineHeight: '1.6',
                marginBottom: '20px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em'
              }}>THE MARKET REWARDS STRENGTH</p>
              <p style={{
                fontSize: '14px',
                color: '#ccc',
                lineHeight: '1.6'
              }}>
                Ranking 1,700+ assets daily by head-to-head tournament strength.
              </p>
            </div>

            {/* Links Column */}
            <div>
              <h4 style={{
                fontSize: '12px',
                color: '#00ff9d',
                marginBottom: '20px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                fontWeight: '700'
              }}>LINKS</h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <span 
                  onClick={() => setActivePage('how-it-works')} 
                  style={{color: '#ccc', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  How It Works
                </span>
                <span 
                  onClick={() => setActivePage('faq')} 
                  style={{color: '#ccc', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  FAQ
                </span>
                <span 
                  onClick={() => setActivePage('partners')} 
                  style={{color: '#ccc', cursor: 'pointer', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  Partners
                </span>
                <a 
                  href="#privacy" 
                  style={{color: '#ccc', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  Privacy Policy
                </a>
              </div>
            </div>

            {/* Connect Column */}
            <div>
              <h4 style={{
                fontSize: '12px',
                color: '#00ff9d',
                marginBottom: '20px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
                fontWeight: '700'
              }}>CONNECT</h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <a 
                  href="mailto:frontrunnerapphq@gmail.com" 
                  style={{color: '#ccc', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  frontrunnerapphq@gmail.com
                </a>
                <a 
                  href="https://twitter.com/frontrunnerhq" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{color: '#ccc', textDecoration: 'none', fontSize: '14px', transition: 'color 0.2s'}}
                  onMouseEnter={(e) => e.target.style.color = '#00ff9d'}
                  onMouseLeave={(e) => e.target.style.color = '#ccc'}
                >
                  @frontrunnerhq
                </a>
              </div>

              {/* Social Icons */}
              <div style={{display: 'flex', gap: '12px', marginTop: '20px'}}>
                <a 
                  href="https://twitter.com/frontrunnerhq" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(0, 255, 157, 0.1)',
                    border: '1px solid rgba(0, 255, 157, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00ff9d',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    fontSize: '16px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 157, 0.2)'
                    e.currentTarget.style.borderColor = '#00ff9d'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 157, 0.1)'
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 157, 0.3)'
                  }}
                >
                  𝕏
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{
            paddingTop: '30px',
            borderTop: '1px solid rgba(0, 255, 157, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            alignItems: 'center'
          }}>
            <p style={{
              fontSize: '13px',
              color: '#888',
              textAlign: 'center',
              lineHeight: '1.6',
              maxWidth: '600px'
            }}>
              FrontRunner provides market data for informational purposes only. Nothing on this site constitutes investment advice. Always do your own research.
            </p>
            <p style={{
              fontSize: '12px',
              color: '#666',
              fontFamily: 'var(--font-mono)'
            }}>
              © 2026 FrontRunner • Built for traders who follow strength
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
