import axios from 'axios'

export class ExchangeRateService {
  private usdKrw = 1380
  private usdtKrw = 1378
  
  async fetchRates(): Promise<void> {
    try {
      const res = await axios.get('https://api.exchangerate-api.com/v4/latest/USD')
      this.usdKrw = res.data.rates.KRW || 1380
      this.usdtKrw = this.usdKrw * 0.998
      console.log(`[환율] USD/KRW: ${this.usdKrw}, USDT/KRW: ${this.usdtKrw}`)
    } catch (e) {
      console.log('[환율] 기본값 사용')
    }
  }
  
  getUsdKrw() { return this.usdKrw }
  getUsdtKrw() { return this.usdtKrw }
  convertToKrw(price: number, currency: 'USDT' | 'USD'): number {
    return price * (currency === 'USDT' ? this.usdtKrw : this.usdKrw)
  }
}