import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class BinanceSpotAdapter extends BaseExchangeAdapter {
  exchange = 'binance' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr')
      this.ws.on('open', () => {
        console.log('[BinanceSpot] ✅ 연결')
        this.connected = true
        resolve()
      })
      this.ws.on('message', (data: Buffer) => {
        const tickers = JSON.parse(data.toString())
        tickers.forEach((t: any) => {
          if (t.s.endsWith('USDT') && this.subscribedSymbols.includes(t.s.replace('USDT', ''))) {
            const symbol = t.s.replace('USDT', '')
            const price = parseFloat(t.c)
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
        })
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    console.log(`[BinanceSpot] 구독: ${symbols.length}개`)
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}