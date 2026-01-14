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

          // MEXC miniTicker format: { d: { s: "BTCUSDT", c: "123.45", ... } }
          if (msg.d && typeof msg.d === 'object') {
            const d = msg.d
            const symbol = d.s?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(d.c || d.p || '0')
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

          // Direct format: { s: "BTCUSDT", c: "123.45", ... }
          if (msg.s && msg.c) {
            const symbol = msg.s?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.c || '0')
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
        } catch {}
      })

      this.ws.on('error', () => {})
      this.ws.on('close', () => { this.connected = false })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // MEXC V3 API format
      const params = symbols.slice(0, 100).map(s => `spot@public.miniTickers.v3.api@${s}USDT@UTC+8`)

      this.ws.send(JSON.stringify({
        method: 'SUBSCRIPTION',
        params
      }))

      console.log(`[MexcSpot] 구독: ${params.length}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}
