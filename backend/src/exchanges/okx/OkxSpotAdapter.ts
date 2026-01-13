import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class OkxSpotAdapter extends BaseExchangeAdapter {
  exchange = 'okx' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public')
      this.ws.on('open', () => {
        console.log('[OkxSpot] ✅ 연결')
        this.connected = true
        resolve()
      })
      this.ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString())
        if (msg.arg?.channel === 'tickers' && msg.data) {
          msg.data.forEach((d: any) => {
            const symbol = d.instId.replace('-USDT', '')
            if (this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(d.last)
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
        }
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const args = symbols.map(s => ({ channel: 'tickers', instId: `${s}-USDT` }))
      this.ws.send(JSON.stringify({ op: 'subscribe', args }))
      console.log(`[OkxSpot] 구독: ${symbols.length}개`)
    }
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}