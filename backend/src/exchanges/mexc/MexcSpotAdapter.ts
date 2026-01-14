import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class MexcSpotAdapter extends BaseExchangeAdapter {
  exchange = 'mexc' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://wbs.mexc.com/ws')

      this.ws.on('open', () => {
        console.log('[MexcSpot] 연결됨')
        this.connected = true

        // MEXC requires ping every 30 seconds
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: 'PING' }))
          }
        }, 30000)

        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())

          // Handle mini ticker format
          if (msg.c && msg.s) {
            // Format: { s: "BTCUSDT", p: "0.00123", ... }
            const symbol = msg.s?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.c || msg.p || '0')
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
                  volume24h: parseFloat(msg.v || '0'),
                  timestamp: Date.now()
                })
              }
            }
          }

          // Handle subscription response with data
          if (msg.d && msg.s) {
            const symbol = msg.s?.replace('USDT', '')
            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.d.c || msg.d.p || '0')
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
        console.error('[MexcSpot] WebSocket 에러:', err.message)
      })

      this.ws.on('close', () => {
        console.log('[MexcSpot] 연결 종료')
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Subscribe to mini ticker for each symbol
      const params = symbols.slice(0, 100).map(s => `spot@public.miniTicker.v3.api@${s}USDT`)

      this.ws.send(JSON.stringify({
        method: 'SUBSCRIPTION',
        params
      }))

      console.log(`[MexcSpot] 구독: ${params.length}개`)
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
