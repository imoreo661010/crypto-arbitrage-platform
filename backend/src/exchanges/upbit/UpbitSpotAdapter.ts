import WebSocket from 'ws'
import { BaseExchangeAdapter } from '../base/ExchangeAdapter.js'
import { NormalizedTicker, UpbitTickerData } from '../../types/index.js'

export class UpbitSpotAdapter extends BaseExchangeAdapter {
  exchange = 'upbit' as const
  marketType = 'spot' as const
  
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[UpbitSpot] WebSocket 연결 시도...')
      
      this.ws = new WebSocket('wss://api.upbit.com/websocket/v1')

      this.ws.on('open', () => {
        console.log('[UpbitSpot] ✅ WebSocket 연결 성공!')
        this.connected = true
        this.reconnectAttempts = 0
        
        if (this.subscribedSymbols.length > 0) {
          this.subscribe(this.subscribedSymbols)
        }
        
        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          
          if (message.type === 'ticker') {
            this.handleTicker(message as UpbitTickerData)
          }
        } catch (error) {
          console.error('[UpbitSpot] 메시지 파싱 오류:', error)
        }
      })

      this.ws.on('error', (error) => {
        console.error('[UpbitSpot] WebSocket 오류:', error.message)
        reject(error)
      })

      this.ws.on('close', () => {
        console.log('[UpbitSpot] ❌ WebSocket 연결 종료')
        this.connected = false
        this.attemptReconnect()
      })
    })
  }

  subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[UpbitSpot] WebSocket이 열려있지 않음. 심볼 저장만 수행')
      this.subscribedSymbols = symbols
      return
    }

    const markets = symbols.map(s => s.startsWith('KRW-') ? s : `KRW-${s}`)
    this.subscribedSymbols = symbols

    const subscribeMessage = [
      { ticket: 'crypto-arbitrage' },
      {
        type: 'ticker',
        codes: markets,
        isOnlyRealtime: true
      }
    ]

    this.ws.send(JSON.stringify(subscribeMessage))
    console.log(`[UpbitSpot] 구독 완료: ${markets.length}개 마켓`)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }

  private handleTicker(data: UpbitTickerData): void {
    const symbol = data.code.split('-')[1]

    const normalized: NormalizedTicker = {
      exchange: this.exchange,
      marketType: this.marketType,
      symbol,
      baseCurrency: 'KRW',
      
      bid: data.trade_price,
      ask: data.trade_price,
      last: data.trade_price,
      
      bidOriginal: data.trade_price,
      askOriginal: data.trade_price,
      lastOriginal: data.trade_price,
      
      volume24h: data.acc_trade_volume_24h,
      timestamp: Date.now()
    }

    this.emitTicker(normalized)
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[UpbitSpot] 최대 재연결 시도 횟수 초과')
      return
    }

    this.reconnectAttempts++
    console.log(`[UpbitSpot] ${this.reconnectDelay / 1000}초 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[UpbitSpot] 재연결 실패:', err)
      })
    }, this.reconnectDelay)
  }
}