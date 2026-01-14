import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class BybitSpotAdapter extends BaseExchangeAdapter {
  exchange = 'bybit' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      // Bybit V5 public spot stream
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot')

      this.ws.on('open', () => {
        console.log('[BybitSpot] 연결됨')
        this.connected = true

        // Ping every 20 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ op: 'ping' }))
          }
        }, 20000)

        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())

          // Handle ticker data
          if (msg.topic?.startsWith('tickers.') && msg.data) {
            const d = msg.data
            // symbol format: "BTCUSDT" -> "BTC"
            const symbol = d.symbol?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(d.lastPrice || '0')
              if (price > 0) {
                this.emitTicker({
                  exchange: this.exchange,
                  marketType: this.marketType,
                  symbol,
                  baseCurrency: 'USDT',
                  bid: price * this.exchangeRate,
                  ask: price * this.exchangeRate,
                  last: price * this.exchangeRate,
                  lastOriginal: price,
                  volume24h: parseFloat(d.volume24h || '0'),
                  timestamp: Date.now()
                })
              }
            }
          }
        } catch {
          // Skip parse errors
        }
      })

      this.ws.on('error', (err) => {
        console.error('[BybitSpot] WebSocket 에러:', err.message)
      })

      this.ws.on('close', () => {
        console.log('[BybitSpot] 연결 종료')
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Subscribe in batches of 10 (Bybit limit)
      const batchSize = 10
      for (let i = 0; i < Math.min(symbols.length, 100); i += batchSize) {
        const batch = symbols.slice(i, i + batchSize)
        const args = batch.map(s => `tickers.${s}USDT`)

        this.ws.send(JSON.stringify({
          op: 'subscribe',
          args
        }))
      }
      console.log(`[BybitSpot] 구독: ${Math.min(symbols.length, 100)}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.ws?.close()
    this.connected = false
  }
}
