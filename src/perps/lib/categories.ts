// Static sector tags for the market picker. Hyperliquid's meta carries no
// category data, so this is a curated map; unlisted coins only appear in All.
// Names are matched after stripping HL's thousand-lot "k" prefix (kPEPE → PEPE).

const CATEGORY_COINS: Record<string, string[]> = {
  AI: ['TAO', 'FET', 'RENDER', 'WLD', 'IO', 'VIRTUAL', 'AI16Z', 'AIXBT', 'GRIFFAIN', 'ZEREBRO'],
  DeFi: ['UNI', 'AAVE', 'CRV', 'LDO', 'MKR', 'COMP', 'SUSHI', 'JUP', 'PENDLE', 'ENA', 'DYDX', 'GMX', 'LINK', 'SNX'],
  Gaming: ['GALA', 'IMX', 'SAND', 'MANA', 'AXS', 'PIXEL', 'GMT', 'YGG', 'ILV'],
  'Layer 1': ['SOL', 'AVAX', 'ADA', 'APT', 'SUI', 'SEI', 'TON', 'NEAR', 'TIA', 'DOT', 'ATOM', 'INJ', 'HYPE', 'TRX', 'BCH', 'LTC', 'ETC', 'FTM', 'S', 'BNB', 'XRP'],
  'Layer 2': ['ARB', 'OP', 'STRK', 'ZK', 'POL', 'MATIC', 'BLAST', 'MANTA', 'TAIKO', 'SCR'],
  Memes: ['DOGE', 'WIF', 'PEPE', 'SHIB', 'BONK', 'FLOKI', 'FARTCOIN', 'POPCAT', 'MEW', 'PNUT', 'MOODENG', 'TRUMP', 'MELANIA', 'SPX', 'GOAT', 'CHILLGUY', 'PURR', 'BRETT', 'TURBO', 'NEIRO'],
};

export const CATEGORIES = ['All', ...Object.keys(CATEGORY_COINS)] as const;
export type Category = (typeof CATEGORIES)[number];

function normalize(coin: string): string {
  return coin.startsWith('k') ? coin.slice(1) : coin;
}

export function inCategory(coin: string, category: Category): boolean {
  if (category === 'All') return true;
  return CATEGORY_COINS[category]?.includes(normalize(coin)) ?? false;
}
