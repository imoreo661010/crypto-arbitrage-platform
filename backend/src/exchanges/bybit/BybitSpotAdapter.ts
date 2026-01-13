import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class BybitSpotAdapter extends BaseExchangeAdapter {
  exchange = 'bybit' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: any = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot')
      
      this.ws.on('open', () => {
        console.log('[BybitSpot] ✅ 연결')
        this.connected = true
        
        // Ping every 20s
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
          
          if (msg.topic?.startsWith('tickers.') && msg.data) {
            const d = msg.data
            const symbol = d.symbol?.replace('USDT', '')
            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(d.lastPrice || d.c || '0')
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
                  volume24h: parseFloat(d.volume24h || d.v || '0'),
                  timestamp: Date.now()
                })
              }
            }
          }
        } catch (e) {
          // Skip errors
        }
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const args = symbols.slice(0, 100).map(s => `tickers.${s}USDT`)
      this.ws.send(JSON.stringify({ op: 'subscribe', args }))
      console.log(`[BybitSpot] 구독: ${args.length}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}