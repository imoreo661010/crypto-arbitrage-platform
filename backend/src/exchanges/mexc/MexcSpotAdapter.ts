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
      // MEXC WebSocket URL
      this.ws = new WebSocket('wss://wbs.mexc.com/ws')

      this.ws.on('open', () => {
        console.log('[MexcSpot] 연결됨')
        this.connected = true

        // MEXC는 30초마다 ping 필요
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

          // MEXC miniTicker 응답 형식 (문서 기준):
          // {
          //   "channel": "spot@public.miniTicker.v3.api.pb@BTCUSDT@UTC+8",
          //   "symbol": "BTCUSDT",
          //   "publicMiniTicker": {
          //     "symbol": "BTCUSDT",
          //     "price": "95000.5"
          //   }
          // }
          if (msg.publicMiniTicker) {
            const ticker = msg.publicMiniTicker
            const symbol = ticker.symbol?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(ticker.price || '0')
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

          // 혹시 다른 형식으로 오는 경우 대비 (d.s, d.c 형식)
          if (msg.d && msg.d.s && msg.d.c) {
            const symbol = msg.d.s?.replace('USDT', '')
            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(msg.d.c || '0')
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
      // MEXC V3 API 정확한 형식 (문서 기준):
      // spot@public.miniTicker.v3.api.pb@<SYMBOL>@<TIMEZONE>
      // - miniTicker (s 없음!)
      // - .pb 추가 (Protobuf)
      const params = symbols.slice(0, 30).map(s =>
        `spot@public.miniTicker.v3.api.pb@${s}USDT@UTC+8`
      )

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
