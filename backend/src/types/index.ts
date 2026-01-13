// 마켓 타입
export type MarketType = 'spot' | 'futures' | 'perpetual' | 'swap'

// 거래소 이름
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

// 정규화된 티커 데이터
export interface NormalizedTicker {
  exchange: ExchangeName
  marketType: MarketType       // 🆕 Spot/Futures/Perpetual/Swap
  symbol: string               // "BTC", "ETH", "XRP"
  baseCurrency: 'KRW' | 'USDT' | 'USD'
  
  bid: number                  // 매수 최고가 (KRW 환산)
  ask: number                  // 매도 최저가 (KRW 환산)
  last: number                 // 최근 체결가 (KRW 환산)
  
  // 원본 가격 (환율 적용 전)
  bidOriginal?: number         // 🆕
  askOriginal?: number         // 🆕
  lastOriginal?: number        // 🆕
  
  volume24h?: number           // 24시간 거래량
  
  // 선물 전용 필드
  fundingRate?: number         // 🆕 펀딩비 (8시간당 %)
  nextFundingTime?: number     // 🆕 다음 펀딩 시간
  openInterest?: number        // 🆕 미결제 약정
  
  timestamp: number
}

// Upbit 원본 데이터 구조
export interface UpbitTickerData {
  type: string
  code: string                    // "KRW-BTC"
  opening_price: number
  high_price: number
  low_price: number
  trade_price: number             // 현재가
  prev_closing_price: number
  change: string
  change_price: number
  change_rate: number
  signed_change_price: number
  signed_change_rate: number
  trade_volume: number
  acc_trade_price: number
  acc_trade_price_24h: number
  acc_trade_volume: number
  acc_trade_volume_24h: number
  highest_52_week_price: number
  highest_52_week_date: string
  lowest_52_week_price: number
  lowest_52_week_date: string
  timestamp: number
}

// 아비트라지 갭 타입
export type GapType = 'spot-spot' | 'spot-futures' | 'futures-futures'

// 아비트라지 기회
export interface ArbitrageOpportunity {
  id: string                    // 고유 ID
  type: GapType                 // 갭 타입
  symbol: string                // "BTC", "ETH"
  
  // 매수 정보 (싸게 사는 곳)
  buyExchange: ExchangeName
  buyMarketType: MarketType
  buyPrice: number              // KRW 환산
  buyPriceOriginal: number      // 원본 통화
  buyCurrency: 'KRW' | 'USDT' | 'USD'
  
  // 매도 정보 (비싸게 파는 곳)
  sellExchange: ExchangeName
  sellMarketType: MarketType
  sellPrice: number             // KRW 환산
  sellPriceOriginal: number     // 원본 통화
  sellCurrency: 'KRW' | 'USDT' | 'USD'
  
  // 갭 정보
  spreadPercent: number         // 갭 % (수수료 제외)
  netSpreadPercent?: number     // 순수익 % (수수료 포함)
  
  // 수익 정보
  estimatedProfit: number       // 예상 수익 (100만원 기준)
  
  // 선물 전용
  fundingRate?: number          // 펀딩비
  
  timestamp: number
}