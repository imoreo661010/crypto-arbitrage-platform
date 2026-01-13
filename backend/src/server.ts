import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server } from 'socket.io'
import { config } from './config/index.js'
import { PriceService } from './services/PriceService.js'
import { ExchangeManager } from './services/ExchangeManager.js'
import { UpbitMarketService } from './services/UpbitMarketService.js'
import { ExchangeRateService } from './services/ExchangeRateService.js'
import { GapHistoryService } from './services/GapHistoryService.js'
import { UpbitSpotAdapter } from './exchanges/upbit/UpbitSpotAdapter.js'
import { BinanceSpotAdapter } from './exchanges/binance/BinanceSpotAdapter.js'
import { BinanceFuturesAdapter } from './exchanges/binance/BinanceFuturesAdapter.js'
import { BybitSpotAdapter } from './exchanges/bybit/BybitSpotAdapter.js'
import { OkxSpotAdapter } from './exchanges/okx/OkxSpotAdapter.js'
import { MexcSpotAdapter } from './exchanges/mexc/MexcSpotAdapter.js'
import { GateioSpotAdapter } from './exchanges/gateio/GateioSpotAdapter.js'
import { BitgetSpotAdapter } from './exchanges/bitget/BitgetSpotAdapter.js'
import { KucoinSpotAdapter } from './exchanges/kucoin/KucoinSpotAdapter.js'
import { NormalizedTicker } from './types/index.js'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: config.frontendUrl, methods: ['GET', 'POST'] }
})

app.use(cors({ origin: config.frontendUrl }))
app.use(express.json())

const priceService = new PriceService()
const exchangeManager = new ExchangeManager()
const upbitMarketService = new UpbitMarketService()
const exchangeRateService = new ExchangeRateService()
const gapHistoryService = new GapHistoryService()

// REST API
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/prices', (req, res) => {
  res.json(priceService.getAllPricesAsObject())
})

app.get('/api/exchanges/status', (req, res) => {
  res.json(exchangeManager.getStatus())
})

app.get('/api/stats', (req, res) => {
  res.json(priceService.getStats())
})

// 히스토리 API
app.get('/api/history/recent', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100
  res.json(gapHistoryService.getRecent(limit))
})

app.get('/api/history/:symbol', (req, res) => {
  const { symbol } = req.params
  const limit = parseInt(req.query.limit as string) || 100
  res.json(gapHistoryService.getBySymbol(symbol.toUpperCase(), limit))
})

app.get('/api/history/stats', (req, res) => {
  res.json({
    total: gapHistoryService.getCount(),
    maxSize: 10000
  })
})

// Socket.IO
io.on('connection', (socket) => {
  console.log(`[Socket.IO] 클라이언트 연결: ${socket.id}`)
  socket.emit('initial-prices', priceService.getAllPricesAsObject())
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] 클라이언트 연결 해제: ${socket.id}`)
  })
})

// 거래소 초기화
async function initializeExchanges() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔄 거래소 초기화 시작...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. 환율 로딩
  console.log('\n[1/5] 환율 로딩...')
  await exchangeRateService.fetchRates()

  // 2. 업비트 마켓 리스트
  console.log('\n[2/5] 업비트 마켓 리스트 로딩...')
  await upbitMarketService.fetchMarkets()
  const symbols = upbitMarketService.getSymbols()
  console.log(`✅ ${symbols.length}개 코인 발견`)

  // 3. Adapter 등록
  console.log('\n[3/5] Adapter 등록...')
  
  const upbitSpot = new UpbitSpotAdapter()
  
  const binanceSpot = new BinanceSpotAdapter()
  const binanceFutures = new BinanceFuturesAdapter()
  
  const bybitSpot = new BybitSpotAdapter()
  const okxSpot = new OkxSpotAdapter()
  const mexcSpot = new MexcSpotAdapter()
  
  const gateioSpot = new GateioSpotAdapter()
  const bitgetSpot = new BitgetSpotAdapter()
  const kucoinSpot = new KucoinSpotAdapter()

  const rate = exchangeRateService.getUsdtKrw()
  binanceSpot.setExchangeRate(rate)
  binanceFutures.setExchangeRate(rate)
  bybitSpot.setExchangeRate(rate)
  okxSpot.setExchangeRate(rate)
  mexcSpot.setExchangeRate(rate)
  gateioSpot.setExchangeRate(rate)
  bitgetSpot.setExchangeRate(rate)
  kucoinSpot.setExchangeRate(rate)

  exchangeManager.registerAdapter(upbitSpot)
  exchangeManager.registerAdapter(binanceSpot)
  exchangeManager.registerAdapter(binanceFutures)
  exchangeManager.registerAdapter(bybitSpot)
  exchangeManager.registerAdapter(okxSpot)
  exchangeManager.registerAdapter(mexcSpot)
  exchangeManager.registerAdapter(gateioSpot)
  exchangeManager.registerAdapter(bitgetSpot)
  exchangeManager.registerAdapter(kucoinSpot)

  // 4. 거래소 연결
  console.log('\n[4/5] 거래소 연결...')
  await exchangeManager.connectAll()

  // 5. 심볼 구독
  console.log(`\n[5/5] ${symbols.length}개 코인 구독...`)
  exchangeManager.subscribeAll(symbols)

  // Ticker 데이터 처리
  const priceUpdateBuffer: NormalizedTicker[] = []
  let lastHistorySave = 0

  exchangeManager.onTicker((ticker) => {
    priceService.updatePrice(ticker)
    priceUpdateBuffer.push(ticker)
  })

  // 1초마다 배치 전송 + 1분마다 히스토리 저장
  setInterval(() => {
    // 가격 배치 전송
    if (priceUpdateBuffer.length > 0 && io.engine.clientsCount > 0) {
      const updates = [...priceUpdateBuffer]
      priceUpdateBuffer.length = 0
      io.emit('price-updates-batch', updates)
    }
    
    // 1분마다 히스토리 저장
    const now = Date.now()
    if (now - lastHistorySave >= 60000) {
      lastHistorySave = now
      
      try {
        const allPrices = priceService.getAllPrices()
        const symbolMap = new Map<string, NormalizedTicker[]>()
        
        allPrices.forEach(ticker => {
          if (!symbolMap.has(ticker.symbol)) {
            symbolMap.set(ticker.symbol, [])
          }
          symbolMap.get(ticker.symbol)!.push(ticker)
        })
        
        let savedCount = 0
        symbolMap.forEach((tickers, symbol) => {
          if (tickers.length < 2) return
          
          const sorted = [...tickers].sort((a, b) => a.last - b.last)
          const low = sorted[0]
          const high = sorted[sorted.length - 1]
          const spread = ((high.last - low.last) / low.last) * 100
          
          if (spread >= 0.5) {
            gapHistoryService.add({
              symbol,
              spread,
              lowExchange: low.exchange,
              highExchange: high.exchange,
              timestamp: now
            })
            savedCount++
          }
        })
        
        if (savedCount > 0) {
          console.log(`[히스토리] ${savedCount}개 저장 (총: ${gapHistoryService.getCount()}개)`)
        }
      } catch (error) {
        console.error('[히스토리] 저장 오류:', error)
      }
    }
  }, 1000)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 거래소 초기화 완료!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

// 서버 시작
server.listen(config.port, async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 암호화폐 아비트라지 백엔드 서버 시작!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📡 서버: http://localhost:${config.port}`)
  console.log(`🌍 환경: ${config.nodeEnv}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await initializeExchanges()
})

// 우아한 종료
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...')
  exchangeManager.disconnectAll()
  server.close(() => {
    console.log('서버가 종료되었습니다.')
    process.exit(0)
  })
})