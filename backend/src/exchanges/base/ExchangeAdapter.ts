import { ExchangeName, MarketType, NormalizedTicker } from '../../types/index.js'

export interface ExchangeAdapter {
  exchange: ExchangeName
  marketType: MarketType
  connect(): Promise<void>
  disconnect(): void
  isConnected(): boolean
  subscribe(symbols: string[]): void
  getSubscribedSymbols(): string[]
  onTicker(callback: (ticker: NormalizedTicker) => void): void
  getStatus(): {
    exchange: ExchangeName
    marketType: MarketType
    connected: boolean
    subscribedSymbols: number
    lastUpdate?: number
  }
}

export abstract class BaseExchangeAdapter implements ExchangeAdapter {
  abstract exchange: ExchangeName
  abstract marketType: MarketType
  
  public connected = false
  public subscribedSymbols: string[] = []
  protected tickerCallback?: (ticker: NormalizedTicker) => void
  protected lastUpdate?: number

  abstract connect(): Promise<void>
  abstract disconnect(): void
  abstract subscribe(symbols: string[]): void

  isConnected(): boolean {
    return this.connected
  }

  getSubscribedSymbols(): string[] {
    return this.subscribedSymbols
  }

  onTicker(callback: (ticker: NormalizedTicker) => void): void {
    this.tickerCallback = callback
  }

  getStatus() {
    return {
      exchange: this.exchange,
      marketType: this.marketType,
      connected: this.connected,
      subscribedSymbols: this.subscribedSymbols.length,
      lastUpdate: this.lastUpdate
    }
  }

  protected emitTicker(ticker: NormalizedTicker): void {
    this.lastUpdate = Date.now()
    if (this.tickerCallback) {
      this.tickerCallback(ticker)
    }
  }
}