import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'

export class BybitSpotAdapter extends BaseExchangeAdapter {
  exchange = 'bybit' as const
  marketType = 'spot' as const
  private ws: WebSocket | null = null
  private exchangeRate = 1380
  private pingInterval: ReturnType<typeof setInterval> | null = null

  setExchangeRate(rate: number) { this.exchangeRate = rate }

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot')

      this.ws.on('open', () => {
        console.log('[BybitSpot] 연결됨')
        this.connected = true

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

          // 디버그: 메시지 샘플링
          if (Math.random() < 0.01) {
            console.log('[BybitSpot] 메시지:', JSON.stringify(msg).slice(0, 300))
          }

          // Bybit V5 ticker response format
          // msg.topic이 'tickers.'로 시작하는지 확인 (pong, 구독확인 등 다른 메시지 제외)
          if (msg.topic?.startsWith('tickers.') && msg.data) {
            const d = msg.data
            const symbol = d.symbol?.replace('USDT', '')

            if (symbol && this.subscribedSymbols.includes(symbol)) {
              const price = parseFloat(d.lastPrice || '0')
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

      this.ws.on('error', (err) => {
        console.error('[BybitSpot] 에러:', err.message)
      })
      this.ws.on('close', (code, reason) => {
        console.log(`[BybitSpot] 연결 종료: ${code} - ${reason}`)
        this.connected = false
      })
    })
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Bybit: 개별 심볼로 구독
      const args = symbols.slice(0, 100).map(s => `tickers.${s}USDT`)

      this.ws.send(JSON.stringify({
        op: 'subscribe',
        args
      }))

      console.log(`[BybitSpot] 구독: ${args.length}개`)
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.connected = false
  }
}
