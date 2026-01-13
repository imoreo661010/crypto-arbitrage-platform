export type MarketType = 'spot' | 'futures' | 'perpetual' | 'swap'

export type ExchangeName = 
  | 'upbit' 
  | 'binance' 
  | 'bybit' 
  | 'okx' 
  | 'mexc' 
  | 'gateio' 
  | 'bitget' 
  | 'kucoin' 
  | 'bingx'
  | 'hyperliquid'
  | 'lighter'
  | 'edgex'

export interface NormalizedTicker {
  exchange: ExchangeName
  marketType: MarketType
  symbol: string
  baseCurrency: 'KRW' | 'USDT' | 'USD'
  
  bid: number
  ask: number
  last: number
  
  bidOriginal?: number
  askOriginal?: number
  lastOriginal?: number
  
  volume24h?: number
  
  fundingRate?: number
  nextFundingTime?: number
  openInterest?: number
  
  timestamp: number
}