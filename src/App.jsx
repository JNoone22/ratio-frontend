import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = 'https://api.frontrunnerapp.site/api'

function App() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [activePage, setActivePage] = useState('board') // 'board' or 'grid'
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
    // Classify commodities (specific commodity trackers, not broad baskets like DBC)
    const commoditySymbols = ['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB', 'CPER', 'PPLT', 'PALL', 'UGA', 'URNM']
    const isCommodity = commoditySymbols.includes(asset.symbol)
    
    // S&P 500 flag comes from backend
    const isSP500 = asset.sp500 === true
    
    // Special handling for EMA8 filter - show ONLY assets above EMA8
    if (filter === 'ema8') {
      return asset.above_ema8 === true
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
    return matchesFilter
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
    'GLD': 'GOLD',
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
            <a href="#start" className="nav-link">START HERE</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#about" className="nav-link">ABOUT</a>
            <a href="#partners" className="nav-link">PARTNERS</a>
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
              
              <div className="filter-tabs">
                {['all', 'sp500', 'etfs', 'commodity', 'crypto', 'ema8'].map(tab => (
                  <button
                    key={tab}
                    className={`filter-tab ${filter === tab ? 'active' : ''}`}
                    onClick={() => setFilter(tab)}
                  >
                    {tab === 'sp500' ? 'S&P 500' : tab === 'commodity' ? 'COMMODITY' : tab === 'ema8' ? 'EMA8' : tab.toUpperCase()}
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
                      {['GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT', 'SOYB', 'CPER', 'PPLT', 'PALL', 'UGA', 'URNM'].includes(asset.symbol) 
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
                  className={`filter-tab ${gridType === 'commodity' ? 'active' : ''}`}
                  onClick={() => setGridType('commodity')}
                >
                  COMMODITY
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
                      Each cell shows the winner of a head-to-head matchup. <strong className="win-indicator">WIN</strong> means the row asset is above its 20W MA while the column asset is below theirs. <strong className="loss-indicator">LOSS</strong> means the opposite. Assets with more wins are stronger.
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* START HERE Section */}
      <div id="start" style={{padding: '60px 20px', maxWidth: '800px', margin: '0 auto', display: activePage === 'board' ? 'block' : 'none'}}>
        <h2 style={{fontSize: '32px', marginBottom: '20px', color: '#00ff9d'}}>How FrontRunner Works</h2>
        
        <div style={{marginBottom: '30px'}}>
          <h3 style={{fontSize: '20px', marginBottom: '10px'}}>The Tournament System</h3>
          <p style={{lineHeight: '1.6', color: '#ccc'}}>
            Every asset competes head-to-head against every other asset. An asset wins a matchup if it's above its 20-week moving average 
            while its opponent is below theirs. The asset with the most wins ranks #1.
          </p>
        </div>

        <div style={{marginBottom: '30px'}}>
          <h3 style={{fontSize: '20px', marginBottom: '10px'}}>What the 20-Week MA Means</h3>
          <p style={{lineHeight: '1.6', color: '#ccc'}}>
            The 20-week simple moving average is a proven indicator of asset strength. When price is above this line, 
            the asset is in an uptrend. When below, it's in a downtrend. Simple, visual, effective.
          </p>
        </div>

        <div style={{marginBottom: '30px'}}>
          <h3 style={{fontSize: '20px', marginBottom: '10px'}}>How to Use FrontRunner</h3>
          <p style={{lineHeight: '1.6', color: '#ccc'}}>
            <strong>The Big Board:</strong> See all ranked assets. Filter by type (stocks, crypto, ETFs) to find the strongest in each category.<br/><br/>
            <strong>The Grid:</strong> Compare specific groups head-to-head. See exactly how the Mag 7 stack up, or which crypto is dominating.<br/><br/>
            <strong>Win Rate:</strong> Higher = more consistent strength. A 90%+ win rate means the asset is beating almost everything.
          </p>
        </div>
      </div>

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
    </div>
  )
}

export default App
