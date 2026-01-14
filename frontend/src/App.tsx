import { useEffect, useState, useMemo } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { NormalizedTicker } from './types/index'
import { GapChart } from './components/GapChart'

type Menu = 'arbitrage' | 'top10' | 'upbit' | 'binance' | 'binance-futures' | 'bybit' | 'okx' | 'mexc' | 'gateio' | 'bitget' | 'kucoin'

interface Gap {
  symbol: string
  low: NormalizedTicker
  high: NormalizedTicker
  spread: number
  volume: number
  gapType: 'spot-spot' | 'spot-futures' | 'futures-futures'
}

interface Filters {
  minGap: number
  exchanges: Record<string, boolean>
  gapTypes: {
    spotSpot: boolean
    spotFutures: boolean
    futuresFutures: boolean
  }
  searchQuery: string
}

function App() {
  const { socket, connected } = useWebSocket()
  const [prices, setPrices] = useState<Map<string, NormalizedTicker>>(new Map())
  const [selectedMenu, setSelectedMenu] = useState<Menu>('top10')
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<Filters>({
    minGap: 0.5,
    exchanges: {
      upbit: true, binance: true, bybit: true, okx: true, mexc: true, 
      gateio: true, bitget: true, kucoin: true
    },
    gapTypes: { spotSpot: true, spotFutures: true, futuresFutures: true },
    searchQuery: ''
  })
  
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [alertGap, setAlertGap] = useState(3.0)
  const [lastAlertTime, setLastAlertTime] = useState(0)

  // 차트 모달용 상태 (클릭한 코인)
  const [selectedCoinForChart, setSelectedCoinForChart] = useState<string | null>(null)

  useEffect(() => {
    if (!socket) return
    
    socket.on('initial-prices', (data: Record<string, Record<string, NormalizedTicker>>) => {
      const newPrices = new Map<string, NormalizedTicker>()
      Object.entries(data).forEach(([symbol, exchanges]) => {
        Object.entries(exchanges).forEach(([exchangeKey, ticker]) => {
          const key = `${symbol}-${exchangeKey}`
          newPrices.set(key, ticker)
        })
      })
      setPrices(newPrices)
    })
    
    socket.on('price-updates-batch', (tickers: NormalizedTicker[]) => {
      setPrices(prev => {
        const newPrices = new Map(prev)
        tickers.forEach(ticker => {
          const key = `${ticker.symbol}-${ticker.exchange}-${ticker.marketType}`
          newPrices.set(key, ticker)
        })
        return newPrices
      })
    })
    
    return () => {
      socket.off('initial-prices')
      socket.off('price-updates-batch')
    }
  }, [socket])

  const allGaps = useMemo(() => {
    const symbolMap = new Map<string, NormalizedTicker[]>()
    prices.forEach(ticker => {
      if (!symbolMap.has(ticker.symbol)) symbolMap.set(ticker.symbol, [])
      symbolMap.get(ticker.symbol)!.push(ticker)
    })
    
    const result: Gap[] = []
    symbolMap.forEach((tickers, symbol) => {
      if (tickers.length < 2) return
      
      const sorted = [...tickers].sort((a, b) => a.last - b.last)
      const low = sorted[0]
      const high = sorted[sorted.length - 1]
      const spread = ((high.last - low.last) / low.last) * 100
      
      if (spread >= 0.1) {
        const gapType = 
          (low.marketType === 'spot' && high.marketType === 'spot') ? 'spot-spot' :
          (low.marketType === 'spot' || high.marketType === 'spot') ? 'spot-futures' :
          'futures-futures'
        
        result.push({ symbol, low, high, spread, volume: tickers.reduce((s, t) => s + (t.volume24h || 0), 0), gapType })
      }
    })
    
    return result.sort((a, b) => b.spread - a.spread)
  }, [prices])

  const filteredGaps = useMemo(() => {
    return allGaps.filter(g => {
      if (g.spread < filters.minGap) return false
      if (!filters.exchanges[g.low.exchange] || !filters.exchanges[g.high.exchange]) return false
      if (g.gapType === 'spot-spot' && !filters.gapTypes.spotSpot) return false
      if (g.gapType === 'spot-futures' && !filters.gapTypes.spotFutures) return false
      if (g.gapType === 'futures-futures' && !filters.gapTypes.futuresFutures) return false
      if (filters.searchQuery && !g.symbol.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false
      return true
    })
  }, [allGaps, filters])

  useEffect(() => {
    if (!alertEnabled) return
    
    const now = Date.now()
    if (now - lastAlertTime < 10000) return
    
    const bigGaps = filteredGaps.filter(g => g.spread >= alertGap)
    if (bigGaps.length === 0) return
    
    const topGap = bigGaps[0]
    
    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ8zcKro7bNhHQU+ltTysXEjBS1+zPDaizsIGWS56+OYTQwLUrTp6K5aEwpJoeDku2geBS6Cz/LPhzYHHXTA7t2OTBCWZ7vm')
    beep.play().catch(() => {})
    
    if (Notification.permission === 'granted') {
      new Notification('🔥 큰 갭 발견!', {
        body: `${topGap.symbol}: ${topGap.spread.toFixed(2)}% (${topGap.low.exchange.toUpperCase()} → ${topGap.high.exchange.toUpperCase()})`,
        icon: '/favicon.ico'
      })
    }
    
    setLastAlertTime(now)
  }, [filteredGaps, alertEnabled, alertGap, lastAlertTime])

  const exchangePrices = useMemo(() => {
    const lists: Record<string, NormalizedTicker[]> = {
      upbit: [], binance: [], binanceFutures: [], bybit: [], okx: [], mexc: [], 
      gateio: [], bitget: [], kucoin: []
    }
    
    prices.forEach(t => {
      if (t.exchange === 'upbit') lists.upbit.push(t)
      else if (t.exchange === 'binance' && t.marketType === 'spot') lists.binance.push(t)
      else if (t.exchange === 'binance' && t.marketType === 'futures') lists.binanceFutures.push(t)
      else if (t.exchange === 'bybit') lists.bybit.push(t)
      else if (t.exchange === 'okx') lists.okx.push(t)
      else if (t.exchange === 'mexc') lists.mexc.push(t)
      else if (t.exchange === 'gateio') lists.gateio.push(t)
      else if (t.exchange === 'bitget') lists.bitget.push(t)
      else if (t.exchange === 'kucoin') lists.kucoin.push(t)
    })
    
    Object.keys(lists).forEach(k => {
      lists[k].sort((a, b) => a.symbol.localeCompare(b.symbol))
    })
    
    return lists
  }, [prices])

  const top10 = filteredGaps.slice(0, 10)

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">🔄 아비트라지</h1>
        
        <div className="space-y-2">
          <button onClick={() => setSelectedMenu('top10')} className={`w-full text-left p-3 rounded ${selectedMenu === 'top10' ? 'bg-red-600' : 'hover:bg-gray-700'}`}>🔥 TOP 10</button>
          <button onClick={() => setSelectedMenu('arbitrage')} className={`w-full text-left p-3 rounded ${selectedMenu === 'arbitrage' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>⚡ 전체 아비트라지</button>
          
          <div className="text-sm text-gray-400 mt-4 mb-2">💹 실시간 가격</div>
          <button onClick={() => setSelectedMenu('upbit')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'upbit' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Upbit</button>
          <button onClick={() => setSelectedMenu('binance')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'binance' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Binance Spot</button>
          <button onClick={() => setSelectedMenu('binance-futures')} className={`w-full text-left p-3 rounded text-xs ${selectedMenu === 'binance-futures' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>└ Futures</button>
          <button onClick={() => setSelectedMenu('bybit')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'bybit' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Bybit</button>
          <button onClick={() => setSelectedMenu('okx')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'okx' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>OKX</button>
          <button onClick={() => setSelectedMenu('mexc')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'mexc' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>MEXC</button>
          <button onClick={() => setSelectedMenu('gateio')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'gateio' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Gate.io</button>
          <button onClick={() => setSelectedMenu('bitget')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'bitget' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>Bitget</button>
          <button onClick={() => setSelectedMenu('kucoin')} className={`w-full text-left p-3 rounded text-sm ${selectedMenu === 'kucoin' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>KuCoin</button>
        </div>
        
        <div className="mt-4 border-t border-gray-700 pt-4">
          <button onClick={() => setShowFilters(!showFilters)} className="w-full p-2 bg-gray-700 rounded hover:bg-gray-600 text-sm">
            {showFilters ? '▼' : '▶'} 필터 설정
          </button>
          
          {showFilters && (
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <label className="text-xs text-gray-400">최소 갭: {filters.minGap}%</label>
                <input type="range" min="0" max="5" step="0.1" value={filters.minGap} onChange={(e) => setFilters({...filters, minGap: parseFloat(e.target.value)})} className="w-full" />
              </div>
              
              <div>
                <label className="text-xs text-gray-400">코인 검색</label>
                <input type="text" placeholder="BTC, ETH..." value={filters.searchQuery} onChange={(e) => setFilters({...filters, searchQuery: e.target.value})} className="w-full p-2 bg-gray-700 rounded text-sm" />
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-1 block">거래소</label>
                {Object.keys(filters.exchanges).map(ex => (
                  <label key={ex} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={filters.exchanges[ex]} onChange={(e) => setFilters({...filters, exchanges: {...filters.exchanges, [ex]: e.target.checked}})} />
                    {ex}
                  </label>
                ))}
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-1 block">갭 타입</label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={filters.gapTypes.spotSpot} onChange={(e) => setFilters({...filters, gapTypes: {...filters.gapTypes, spotSpot: e.target.checked}})} />
                  현현갭
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={filters.gapTypes.spotFutures} onChange={(e) => setFilters({...filters, gapTypes: {...filters.gapTypes, spotFutures: e.target.checked}})} />
                  현선갭
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={filters.gapTypes.futuresFutures} onChange={(e) => setFilters({...filters, gapTypes: {...filters.gapTypes, futuresFutures: e.target.checked}})} />
                  선선갭
                </label>
              </div>
              
              <div className="border-t border-gray-600 pt-3">
                <label className="text-xs text-gray-400 mb-2 block">🔔 알림 설정</label>
                <label className="flex items-center gap-2 text-xs mb-2">
                  <input 
                    type="checkbox" 
                    checked={alertEnabled} 
                    onChange={(e) => {
                      setAlertEnabled(e.target.checked)
                      if (e.target.checked && Notification.permission === 'default') {
                        Notification.requestPermission()
                      }
                    }} 
                  />
                  알림 활성화
                </label>
                {alertEnabled && (
                  <div>
                    <label className="text-xs text-gray-400">알림 갭: {alertGap}%</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="0.5" 
                      value={alertGap} 
                      onChange={(e) => setAlertGap(parseFloat(e.target.value))} 
                      className="w-full" 
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {alertGap}% 이상 갭 발생 시 알림
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-xs border-t border-gray-700 pt-4">
          <div className="text-gray-400 mb-2">상태</div>
          <div className="mb-2">{connected ? '🟢 연결됨' : '🔴 연결 안됨'}</div>
          <div className="text-gray-500 space-y-1">
            <div>전체: {prices.size}개</div>
            <div>갭: {filteredGaps.length}/{allGaps.length}개</div>
            {alertEnabled && <div className="text-yellow-400">🔔 알림 ON</div>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedMenu === 'top10' && (
          <div className="p-6">
            <h2 className="text-3xl font-bold mb-6">🔥 실시간 TOP 10</h2>
            {top10.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">데이터 로딩 중...</div>
            ) : (
              <div className="space-y-4">
                {top10.map((g, i) => (
                  <div
                    key={g.symbol}
                    className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700 hover:border-blue-500 cursor-pointer"
                    onClick={() => setSelectedCoinForChart(g.symbol)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold text-gray-600">#{i + 1}</div>
                        <div>
                          <div className="text-2xl font-bold">{g.symbol}</div>
                          <div className="text-xs text-gray-400">{g.gapType === 'spot-spot' ? '현현갭' : g.gapType === 'spot-futures' ? '현선갭' : '선선갭'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl font-bold ${g.spread > 3 ? 'text-red-400' : g.spread > 2 ? 'text-yellow-400' : 'text-green-400'}`}>{g.spread.toFixed(2)}%</div>
                        <div className="text-sm text-gray-400">₩{(g.spread * 10000).toLocaleString()}/100만원</div>
                      </div>
                    </div>
                    <div className="flex gap-8 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-400">매수처</div>
                        <div className="text-lg text-blue-400">{g.low.exchange.toUpperCase()} {g.low.marketType !== 'spot' && '(F)'}</div>
                        <div className="text-sm">₩{g.low.last.toLocaleString()}</div>
                      </div>
                      <div className="text-2xl text-gray-600">→</div>
                      <div>
                        <div className="text-xs text-gray-400">매도처</div>
                        <div className="text-lg text-orange-400">{g.high.exchange.toUpperCase()} {g.high.marketType !== 'spot' && '(F)'}</div>
                        <div className="text-sm">₩{g.high.last.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedMenu === 'arbitrage' && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">⚡ 전체 아비트라지 ({filteredGaps.length}개)</h2>
            <table className="w-full">
              <thead className="bg-gray-800 sticky top-0"><tr><th className="p-3 text-left">코인</th><th className="p-3 text-center">타입</th><th className="p-3 text-right">매수처</th><th className="p-3 text-right">매도처</th><th className="p-3 text-right">갭 %</th></tr></thead>
              <tbody>{filteredGaps.map(g => (<tr key={g.symbol} className="border-b border-gray-800 hover:bg-gray-800/50"><td className="p-3 font-bold">{g.symbol}</td><td className="p-3 text-center text-xs text-gray-400">{g.gapType === 'spot-spot' ? '현현' : g.gapType === 'spot-futures' ? '현선' : '선선'}</td><td className="p-3 text-right text-blue-400 text-sm">{g.low.exchange.toUpperCase()}<br/>₩{g.low.last.toLocaleString()}</td><td className="p-3 text-right text-orange-400 text-sm">{g.high.exchange.toUpperCase()}<br/>₩{g.high.last.toLocaleString()}</td><td className="p-3 text-right font-bold text-green-400">{g.spread.toFixed(2)}%</td></tr>))}</tbody>
            </table>
          </div>
        )}

        {['upbit', 'binance', 'binance-futures', 'bybit', 'okx', 'mexc', 'gateio', 'bitget', 'kucoin'].includes(selectedMenu) && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">💹 {selectedMenu.toUpperCase()} ({exchangePrices[selectedMenu === 'binance-futures' ? 'binanceFutures' : selectedMenu]?.length || 0}개)</h2>
            <table className="w-full"><thead className="bg-gray-800 sticky top-0"><tr><th className="p-3 text-left">코인</th><th className="p-3 text-right">가격</th></tr></thead><tbody>{(exchangePrices[selectedMenu === 'binance-futures' ? 'binanceFutures' : selectedMenu] || []).slice(0, 100).map(t => (<tr key={t.symbol} className="border-b border-gray-800"><td className="p-3">{t.symbol}</td><td className="p-3 text-right text-green-400">₩{t.last.toLocaleString()}</td></tr>))}</tbody></table>
          </div>
        )}
      </div>

      {/* 차트 모달 - 코인 클릭 시 표시 */}
      {selectedCoinForChart && (
        <GapChart
          symbol={selectedCoinForChart}
          onClose={() => setSelectedCoinForChart(null)}
        />
      )}
    </div>
  )
}

export default App