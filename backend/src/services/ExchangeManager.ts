import { ExchangeAdapter } from '../exchanges/base/ExchangeAdapter.js'
import { NormalizedTicker } from '../types/index.js'

export class ExchangeManager {
  private adapters: Map<string, ExchangeAdapter> = new Map()
  private onTickerCallback?: (ticker: NormalizedTicker) => void

  /**
   * Adapter 등록
   */
  registerAdapter(adapter: ExchangeAdapter): void {
    const key = `${adapter.exchange}-${adapter.marketType}`
    
    if (this.adapters.has(key)) {
      console.warn(`[ExchangeManager] ${key} 이미 등록됨`)
      return
    }

    // Ticker 콜백 연결
    adapter.onTicker((ticker) => {
      if (this.onTickerCallback) {
        this.onTickerCallback(ticker)
      }
    })

    this.adapters.set(key, adapter)
    console.log(`[ExchangeManager] ✅ ${key} 등록 완료`)
  }

  /**
   * 모든 거래소 연결
   */
  async connectAll(): Promise<void> {
    console.log(`[ExchangeManager] ${this.adapters.size}개 거래소 연결 시작...`)
    
    const promises = Array.from(this.adapters.values()).map(adapter => 
      adapter.connect().catch(err => {
        console.error(`[ExchangeManager] ${adapter.exchange}-${adapter.marketType} 연결 실패:`, err)
      })
    )

    await Promise.all(promises)
    console.log('[ExchangeManager] ✅ 모든 거래소 연결 완료')
  }

  /**
   * 모든 거래소에 심볼 구독
   */
  subscribeAll(symbols: string[]): void {
    console.log(`[ExchangeManager] ${symbols.length}개 심볼 구독 시작...`)
    
    this.adapters.forEach(adapter => {
      adapter.subscribe(symbols)
    })
  }

  /**
   * 특정 거래소만 구독
   */
  subscribe(exchange: string, marketType: string, symbols: string[]): void {
    const key = `${exchange}-${marketType}`
    const adapter = this.adapters.get(key)
    
    if (adapter) {
      adapter.subscribe(symbols)
    } else {
      console.warn(`[ExchangeManager] ${key} Adapter를 찾을 수 없음`)
    }
  }

  /**
   * 모든 거래소 연결 해제
   */
  disconnectAll(): void {
    this.adapters.forEach(adapter => {
      adapter.disconnect()
    })
    console.log('[ExchangeManager] 모든 거래소 연결 해제')
  }

  /**
   * Ticker 데이터 수신 콜백
   */
  onTicker(callback: (ticker: NormalizedTicker) => void): void {
    this.onTickerCallback = callback
  }

  /**
   * 전체 상태 조회
   */
  getStatus() {
    const statuses = Array.from(this.adapters.values()).map(adapter => 
      adapter.getStatus()
    )

    return {
      totalAdapters: this.adapters.size,
      connected: statuses.filter(s => s.connected).length,
      adapters: statuses
    }
  }

  /**
   * Adapter 가져오기
   */
  getAdapter(exchange: string, marketType: string): ExchangeAdapter | undefined {
    const key = `${exchange}-${marketType}`
    return this.adapters.get(key)
  }
}