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
          const raw = data.toString()
          const msg = JSON.parse(raw)

          // 디버그: 메시지 샘플링 (PONG 제외)
          if (Math.random() < 0.01 && !raw.includes('PONG')) {
            console.log('[MexcSpot] 메시지:', raw.slice(0, 300))
          }

          // MEXC bookTicker 응답 형식:
          // {
          //   "channel": "spot@public.bookTicker.v3.api@BTCUSDT",
          //   "symbol": "BTCUSDT",
          //   "data": {
          //     "A": "93387.29",  // best ask price
          //     "a": "7.669875",  // best ask qty
          //     "B": "93387.28",  // best bid price
          //     "b": "3.73485"    // best bid qty
          //   }
          // }
          // 또는 publicBookTicker 형식
          if (msg.data && msg.symbol) {
            const symbol = msg.symbol?.replace('USDT', '')
            const d = msg.data

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              // A = ask price, B = bid price
              const askPrice = parseFloat(d.A || d.askprice || '0')
              const bidPrice = parseFloat(d.B || d.bidprice || '0')
              const price = askPrice > 0 ? askPrice : bidPrice

              if (price > 0) {
                this.emitTicker({
                  exchange: this.exchange,
                  marketType: this.marketType,
                  symbol,
                  baseCurrency: 'USDT',
                  bid: bidPrice * this.exchangeRate,
                  ask: askPrice * this.exchangeRate,
                  last: price * this.exchangeRate,
                  lastOriginal: price,
                  timestamp: Date.now()
                })
              }
            }
          }

          // publicBookTicker 형식 대응
          if (msg.publicbookticker && msg.symbol) {
            const symbol = msg.symbol?.replace('USDT', '')
            const d = msg.publicbookticker

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const askPrice = parseFloat(d.askprice || '0')
              const bidPrice = parseFloat(d.bidprice || '0')
              const price = askPrice > 0 ? askPrice : bidPrice

              if (price > 0) {
                this.emitTicker({
                  exchange: this.exchange,
                  marketType: this.marketType,
                  symbol,
                  baseCurrency: 'USDT',
                  bid: bidPrice * this.exchangeRate,
                  ask: askPrice * this.exchangeRate,
                  last: price * this.exchangeRate,
                  lastOriginal: price,
                  timestamp: Date.now()
                })
              }
            }
          }
        } catch {}
      })

      this.ws.on('error', (err) => {
        console.error('[MexcSpot] 에러:', err.message)
      })
      this.ws.on('close', (code, reason) => {
        console.log(`[MexcSpot] 연결 종료: ${code} - ${reason}`)
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // MEXC bookTicker 구독 형식:
      // spot@public.bookTicker.v3.api@<SYMBOL>
      const params = symbols.slice(0, 50).map(s =>
        `spot@public.bookTicker.v3.api@${s}USDT`
      )

      this.ws.send(JSON.stringify({
        method: 'SUBSCRIPTION',
        params
      }))

      console.log(`[MexcSpot] 구독: ${params.length}개 (bookTicker)`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}
