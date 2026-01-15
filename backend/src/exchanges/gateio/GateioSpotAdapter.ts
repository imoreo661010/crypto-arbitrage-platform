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

          // 디버그: 메시지 샘플링
          if (Math.random() < 0.01) {
            console.log('[GateioSpot] 메시지:', JSON.stringify(msg).slice(0, 300))
          }

          // Gate.io ticker update
          if (msg.channel === 'spot.tickers' && msg.result) {
            const result = msg.result
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
      // Gate.io: 개별 구독
      symbols.slice(0, 100).forEach(s => {
        this.ws!.send(JSON.stringify({
          time: Math.floor(Date.now() / 1000),
          channel: 'spot.tickers',
          event: 'subscribe',
          payload: [`${s}_USDT`]
        }))
      })

      console.log(`[GateioSpot] 구독: ${Math.min(symbols.length, 100)}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}
