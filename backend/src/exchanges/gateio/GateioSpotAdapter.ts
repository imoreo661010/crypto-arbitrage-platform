import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class GateioSpotAdapter extends BaseExchangeAdapter {
  exchange = 'gateio' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://api.gateio.ws/ws/v4/')
      this.ws.on('open', () => {
        console.log('[GateioSpot] ✅ 연결')
        this.connected = true
        resolve()
      })
      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.channel === 'spot.tickers' && msg.result) {
            const symbol = msg.result.currency_pair?.replace('_USDT', '')
            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.result.last)
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
        } catch (e) {}
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const pairs = symbols.slice(0, 50).map(s => `${s}_USDT`)
      this.ws.send(JSON.stringify({
        time: Date.now(),
        channel: 'spot.tickers',
        event: 'subscribe',
        payload: pairs
      }))
      console.log(`[GateioSpot] 구독: ${pairs.length}개`)
    }
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}