import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class BitgetSpotAdapter extends BaseExchangeAdapter {
  exchange = 'bitget' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://ws.bitget.com/v2/ws/public')
      this.ws.on('open', () => {
        console.log('[BitgetSpot] ✅ 연결')
        this.connected = true
        resolve()
      })
      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.data && Array.isArray(msg.data)) {
            msg.data.forEach((d: any) => {
              const symbol = d.instId?.replace('USDT', '')
              if (symbol && this.subscribedSymbols.includes(symbol)) {
                const price = parseFloat(d.last || d.lastPr || '0')
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
            })
          }
        } catch (e) {}
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const args = symbols.slice(0, 50).map(s => ({ instType: 'SPOT', channel: 'ticker', instId: `${s}USDT` }))
      this.ws.send(JSON.stringify({ op: 'subscribe', args }))
      console.log(`[BitgetSpot] 구독: ${args.length}개`)
    }
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}