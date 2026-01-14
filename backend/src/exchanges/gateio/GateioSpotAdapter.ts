import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class GateioSpotAdapter extends BaseExchangeAdapter {
  exchange = 'gateio' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://api.gateio.ws/ws/v4/')

      this.ws.on('open', () => {
        console.log('[GateioSpot] 연결됨')
        this.connected = true

        // Gate.io requires ping every 30 seconds
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              time: Math.floor(Date.now() / 1000),
              channel: 'spot.ping'
            }))
          }
        }, 30000)

        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())

          // Handle ticker updates
          if (msg.channel === 'spot.tickers' && msg.event === 'update' && msg.result) {
            const result = msg.result
            // currency_pair format: "BTC_USDT" -> "BTC"
            const symbol = result.currency_pair?.replace('_USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(result.last || '0')
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
                  volume24h: parseFloat(result.base_volume || '0'),
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
        console.error('[GateioSpot] WebSocket 에러:', err.message)
      })

      this.ws.on('close', () => {
        console.log('[GateioSpot] 연결 종료')
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Gate.io allows subscribing to multiple pairs at once
      const pairs = symbols.slice(0, 100).map(s => `${s}_USDT`)

      this.ws.send(JSON.stringify({
        time: Math.floor(Date.now() / 1000),
        channel: 'spot.tickers',
        event: 'subscribe',
        payload: pairs
      }))

      console.log(`[GateioSpot] 구독: ${pairs.length}개`)
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
