import WebSocket from 'ws'
import { UpbitTickerData, NormalizedTicker } from '../../types/index.js'

export class UpbitWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000 // 3초
  
  private onTickerCallback?: (ticker: NormalizedTicker) => void
  private markets: string[] = []

  /**
   * WebSocket 연결
   */
  connect(): void {
    console.log('[Upbit] WebSocket 연결 시도...')
    
    this.ws = new WebSocket('wss://api.upbit.com/websocket/v1')

    this.ws.on('open', () => {
      console.log('[Upbit] ✅ WebSocket 연결 성공!')
      this.reconnectAttempts = 0
      
      // 구독할 마켓이 있으면 자동 구독
      if (this.markets.length > 0) {
        this.subscribe(this.markets)
      }
    })

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        
        // ticker 타입 메시지만 처리
        if (message.type === 'ticker') {
          this.handleTicker(message as UpbitTickerData)
        }
      } catch (error) {
        console.error('[Upbit] 메시지 파싱 오류:', error)
      }
    })

    this.ws.on('error', (error) => {
      console.error('[Upbit] WebSocket 오류:', error.message)
    })

    this.ws.on('close', () => {
      console.log('[Upbit] ❌ WebSocket 연결 종료')
      this.attemptReconnect()
    })
  }

  /**
   * 코인 구독
   */
  subscribe(markets: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[Upbit] WebSocket이 열려있지 않아 구독을 나중에 시도합니다.')
      this.markets = markets
      return
    }

    this.markets = markets

    const subscribeMessage = [
      { ticket: 'crypto-arbitrage' },
      {
        type: 'ticker',
        codes: markets,
        isOnlyRealtime: true
      }
    ]

    this.ws.send(JSON.stringify(subscribeMessage))
    console.log(`[Upbit] 구독 완료: ${markets.join(', ')}`)
  }

  /**
   * 티커 데이터 처리
   */
  private handleTicker(data: UpbitTickerData): void {
    // "KRW-BTC" → "BTC"
    const symbol = data.code.split('-')[1]

    const normalized: NormalizedTicker = {
      exchange: 'upbit',
      symbol,
      baseCurrency: 'KRW',
      bid: data.trade_price,
      ask: data.trade_price,
      last: data.trade_price,
      volume24h: data.acc_trade_volume_24h,
      timestamp: Date.now()
    }

    // 콜백 함수 호출
    if (this.onTickerCallback) {
      this.onTickerCallback(normalized)
    }
  }

  /**
   * 티커 데이터 수신 시 실행할 콜백 등록
   */
  onTicker(callback: (ticker: NormalizedTicker) => void): void {
    this.onTickerCallback = callback
  }

  /**
   * 재연결 시도
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Upbit] 최대 재연결 시도 횟수 초과')
      return
    }

    this.reconnectAttempts++
    console.log(`[Upbit] ${this.reconnectDelay / 1000}초 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      this.connect()
    }, this.reconnectDelay)
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}