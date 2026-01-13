import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // 모니터링할 코인 목록
  coins: ['BTC', 'ETH', 'XRP', 'SOL', 'ADA'],
  
  // Upbit 마켓 코드
  upbitMarkets: ['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-ADA']
}