import WebSocket from 'ws'
import axios from 'axios'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker } from '../../types/index.js'

export class KucoinSpotAdapter extends BaseExchangeAdapter {
  exchange = 'kucoin' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    try {
      const res = await axios.post('https://api.kucoin.com/api/v1/bullet-public')
      const { token, instanceServers } = res.data.data
      const endpoint = `${instanceServers[0].endpoint}?token=${token}`
      
      return new Promise((resolve) => {
        this.ws = new WebSocket(endpoint)
        this.ws.on('open', () => {
          console.log('[KucoinSpot] ✅ 연결')
          this.connected = true
          
          setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }))
            }
          }, 20000)
          
          resolve()
        })
        this.ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.topic?.startsWith('/market/ticker:') && msg.data) {
              const d = msg.data
              const symbol = d.symbol?.replace('-USDT', '')
              if (symbol && this.subscribedSymbols.includes(symbol)) {
                const price = parseFloat(d.price || '0')
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
    } catch (e) {
      console.error('[KucoinSpot] 연결 실패')
      throw e
    }
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols
    if (this.ws?.readyState === WebSocket.OPEN) {
      const topics = symbols.slice(0, 50).map(s => `/market/ticker:${s}-USDT`).join(',')
      this.ws.send(JSON.stringify({
        id: Date.now(),
        type: 'subscribe',
        topic: topics,
        response: true
      }))
      console.log(`[KucoinSpot] 구독: ${symbols.slice(0, 50).length}개`)
    }
  }

  disconnect() {
    this.ws?.close()
    this.connected = false
  }
}