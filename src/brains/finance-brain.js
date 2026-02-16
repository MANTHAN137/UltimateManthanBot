/**
 * Finance Brain — Crypto & Stock prices
 * Free APIs: CoinGecko (crypto), no key needed
 * Stocks: Google Finance search link (no API needed)
 */

class FinanceBrain {
    constructor() {
        this.COINGECKO = 'https://api.coingecko.com/api/v3';
        this.cache = new Map();
        this.cryptoAliases = {
            'btc': 'bitcoin', 'bitcoin': 'bitcoin', 'eth': 'ethereum', 'ethereum': 'ethereum',
            'bnb': 'binancecoin', 'sol': 'solana', 'solana': 'solana', 'xrp': 'ripple',
            'doge': 'dogecoin', 'dogecoin': 'dogecoin', 'ada': 'cardano', 'cardano': 'cardano',
            'dot': 'polkadot', 'matic': 'matic-network', 'polygon': 'matic-network',
            'avax': 'avalanche-2', 'shib': 'shiba-inu', 'link': 'chainlink',
            'ltc': 'litecoin', 'litecoin': 'litecoin', 'uni': 'uniswap', 'atom': 'cosmos',
            'near': 'near', 'apt': 'aptos', 'sui': 'sui', 'pepe': 'pepe',
        };
        this.stockAliases = {
            'reliance': 'RELIANCE.NS', 'tcs': 'TCS.NS', 'infosys': 'INFY.NS', 'hdfc': 'HDFCBANK.NS',
            'wipro': 'WIPRO.NS', 'itc': 'ITC.NS', 'sbi': 'SBIN.NS', 'kotak': 'KOTAKBANK.NS',
            'bajaj': 'BAJFINANCE.NS', 'asian paints': 'ASIANPAINT.NS', 'maruti': 'MARUTI.NS',
            'hul': 'HINDUNILVR.NS', 'titan': 'TITAN.NS', 'adani': 'ADANIENT.NS',
            'apple': 'AAPL', 'google': 'GOOGL', 'microsoft': 'MSFT', 'amazon': 'AMZN',
            'tesla': 'TSLA', 'meta': 'META', 'nvidia': 'NVDA', 'netflix': 'NFLX',
        };
        console.log('💰 Finance Brain initialized');
    }

    isFinanceRequest(msg) {
        return /\b(price|rate|value|worth|stock|share|crypto|bitcoin|btc|eth|ethereum|doge|solana|market|nifty|sensex)\b/i.test(msg)
            || /\b(kitna|kya rate|kya price|kya value)\b/i.test(msg);
    }

    async process(message, isGroup = false) {
        const msg = message.toLowerCase();

        // Check crypto first
        const cryptoId = this._detectCrypto(msg);
        if (cryptoId) return await this._getCryptoPrice(cryptoId, isGroup);

        // Check stock
        const stockInfo = this._detectStock(msg);
        if (stockInfo) return this._getStockLink(stockInfo, isGroup);

        // General market query
        if (/\b(market|nifty|sensex|dow|nasdaq)\b/i.test(msg)) {
            return this._getMarketOverview(isGroup);
        }

        return {
            response: `💰 I can check prices! Try:\n• _bitcoin price_\n• _ethereum rate_\n• _TCS share price_\n• _Reliance stock_`,
            source: 'finance-brain/help',
            isQuickResponse: true
        };
    }

    async _getCryptoPrice(coinId, isGroup) {
        // Check cache (2 min)
        const cached = this._getCache(`crypto_${coinId}`);
        if (cached) return cached;

        try {
            const res = await fetch(
                `${this.COINGECKO}/simple/price?ids=${coinId}&vs_currencies=usd,inr&include_24hr_change=true&include_market_cap=true`,
                { signal: AbortSignal.timeout(8000) }
            );
            if (!res.ok) throw new Error(`API ${res.status}`);
            const data = await res.json();
            const coin = data[coinId];
            if (!coin) throw new Error('Coin not found');

            const usd = coin.usd?.toLocaleString('en-US', { maximumFractionDigits: 2 });
            const inr = coin.inr?.toLocaleString('en-IN', { maximumFractionDigits: 2 });
            const change = coin.usd_24h_change?.toFixed(2);
            const changeEmoji = change >= 0 ? '📈' : '📉';
            const mcap = coin.usd_market_cap ? this._formatLargeNum(coin.usd_market_cap) : 'N/A';
            const name = coinId.charAt(0).toUpperCase() + coinId.slice(1);

            const response = isGroup
                ? `💰 *${name}:* $${usd} (₹${inr}) ${changeEmoji} ${change}%`
                : `💰 *${name} Price*\n\n💵 USD: $${usd}\n💴 INR: ₹${inr}\n${changeEmoji} 24h: ${change}%\n📊 Market Cap: $${mcap}\n\n🔗 https://www.coingecko.com/en/coins/${coinId}`;

            const result = { response, source: 'finance-brain/crypto', isQuickResponse: true };
            this._setCache(`crypto_${coinId}`, result);
            return result;
        } catch (error) {
            console.error('   ❌ Crypto API error:', error.message);
            return {
                response: `💰 *${coinId}*\n\nCouldn't fetch live price. Check here:\n🔗 https://www.coingecko.com/en/coins/${coinId}`,
                source: 'finance-brain/crypto-fallback',
                isQuickResponse: true
            };
        }
    }

    _getStockLink(stockInfo, isGroup) {
        const { name, symbol } = stockInfo;
        const gfLink = `https://www.google.com/finance/quote/${symbol}`;
        const response = isGroup
            ? `📊 *${name}*: ${gfLink}`
            : `📊 *${name} Stock*\n\n🔗 *Google Finance:* ${gfLink}\n📈 *TradingView:* https://www.tradingview.com/symbols/${symbol.replace('.NS', '')}`;
        return { response, source: 'finance-brain/stock', isQuickResponse: true };
    }

    _getMarketOverview(isGroup) {
        return {
            response: `📊 *Market Overview*\n\n🇮🇳 *Nifty 50:* https://www.google.com/finance/quote/NIFTY_50:INDEXNSE\n🇮🇳 *Sensex:* https://www.google.com/finance/quote/SENSEX:INDEXBOM\n🇺🇸 *Dow Jones:* https://www.google.com/finance/quote/.DJI:INDEXDJX\n🇺🇸 *Nasdaq:* https://www.google.com/finance/quote/.IXIC:INDEXNASDAQ\n\n_Click any link for live data_`,
            source: 'finance-brain/market',
            isQuickResponse: true
        };
    }

    _detectCrypto(msg) {
        for (const [alias, id] of Object.entries(this.cryptoAliases)) {
            if (new RegExp(`\\b${alias}\\b`, 'i').test(msg)) return id;
        }
        return null;
    }

    _detectStock(msg) {
        for (const [alias, symbol] of Object.entries(this.stockAliases)) {
            if (new RegExp(`\\b${alias}\\b`, 'i').test(msg)) return { name: alias.charAt(0).toUpperCase() + alias.slice(1), symbol };
        }
        return null;
    }

    _formatLargeNum(n) {
        if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        return n.toLocaleString();
    }

    _getCache(k) { const i = this.cache.get(k); if (!i) return null; if (Date.now() - i.t > 120000) { this.cache.delete(k); return null; } return i.d; }
    _setCache(k, d) { if (this.cache.size > 50) { const o = this.cache.keys().next().value; this.cache.delete(o); } this.cache.set(k, { d, t: Date.now() }); }
}

module.exports = new FinanceBrain();
