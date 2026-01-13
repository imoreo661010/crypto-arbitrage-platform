import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class MexcSpotAdapter extends BaseExchangeAdapter {
  exchange = 'mexc' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://wbs.mexc.com/ws')
      
      this.ws.on('open', () => {
        console.log('[MexcSpot] ✅ 연결')
        this.connected = true
        
        // Subscribe immediately
        if (this.subscribedSymbols.length > 0) {
          const symbols = this.subscribedSymbols.slice(0, 100).map(s => `${s}USDT`)
          this.ws!.send(JSON.stringify({
            method: 'SUBSCRIPTION',
            params: symbols.map(s => `spot@public.ticker.v3.api@${s}`)
          }))
        }
        
        resolve()
      })
      
      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          
          if (msg.d && msg.d.p) {
            const symbol = msg.s?.replace('USDT', '') || msg.d.s?.replace('USDT', '')
            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.d.p || msg.d.c || '0')
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
        } catch (e) {
          // Skip errors
        }
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const params = symbols.slice(0, 100).map(s => `spot@public.ticker.v3.api@${s}USDT`)
      this.ws.send(JSON.stringify({ method: 'SUBSCRIPTION', params }))
      console.log(`[MexcSpot] 구독: ${params.length}개`)
    }
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}