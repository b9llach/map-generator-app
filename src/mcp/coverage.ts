// Curated map of ISO-2 country code -> Google Street View coverage category.
//
// Source: https://en.wikipedia.org/wiki/Google_Street_View_coverage
// Curated: 2026-05-26
//
// Categories:
//   official   - Google-car / Google-trike imagery exists across the territory
//   mixed      - Google-car imagery exists but is partial / limited to specific cities or regions
//   unofficial - No Google-car imagery; only Ari (community) photospheres are available
//   none       - No Street View imagery of any kind known to exist
//   unknown    - Not in the curated list (default for codes we have not classified)
//
// This data goes stale as Google rolls out new coverage. To refresh:
//   1. Compare against the Wikipedia article above
//   2. Move codes between sets below
//   3. Bump the "Curated:" date
//
// The dataset focuses on accuracy over completeness: codes we cannot confidently
// classify are intentionally left as `unknown` so callers can distinguish
// "no coverage" from "we don't know".

export type CoverageCategory = 'official' | 'mixed' | 'unofficial' | 'none' | 'unknown'

const OFFICIAL = new Set<string>([
  // Americas
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'PE', 'CO', 'EC', 'BO', 'UY',
  'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA',
  'BS', 'BB', 'BM', 'DM', 'DO', 'GD', 'GP', 'JM', 'KY', 'KN', 'LC', 'MQ', 'MS',
  'PR', 'AG', 'AI', 'VG', 'VI', 'AW', 'CW', 'SX', 'BL', 'MF', 'TC', 'TT', 'VC',
  'FK', 'GF',

  // Europe (EU/EEA + neighbors with full coverage)
  'AL', 'AD', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
  'GR', 'HU', 'IS', 'IE', 'IT', 'XK', 'LV', 'LI', 'LT', 'LU', 'MT', 'MC', 'ME',
  'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH',
  'UA', 'GB', 'VA', 'GI', 'IM', 'JE', 'GG', 'FO', 'AX', 'SJ',

  // Asia / Middle East
  'JP', 'TW', 'TH', 'KH', 'LA', 'VN', 'SG', 'MY', 'PH', 'MN', 'IL', 'JO', 'AE',
  'BD', 'LK', 'BT', 'HK', 'MO', 'BH', 'OM', 'QA', 'SA', 'LB', 'PS',

  // Africa
  'ZA', 'BW', 'LS', 'SZ', 'GH', 'SN', 'KE', 'UG', 'RW', 'TZ', 'MU', 'RE', 'TN',

  // Oceania
  'AU', 'NZ', 'FJ', 'GU', 'MP', 'AS', 'NF', 'NC', 'PF', 'WS', 'TO', 'CK', 'NU',
  'TK', 'PW', 'WF',
])

const MIXED = new Set<string>([
  // Official coverage exists but is partial / city-limited / patchy
  'IN',  // India - several major cities + arterials, large gaps
  'KR',  // South Korea - limited zones
  'ID',  // Indonesia - major islands, sparse elsewhere
  'KZ',  // Kazakhstan - major cities + corridors
  'KG',  // Kyrgyzstan - main routes
  'TJ',  // Tajikistan - limited
  'UZ',  // Uzbekistan - limited
  'TR',  // Turkey - patchy
  'GE',  // Georgia
  'AZ',  // Azerbaijan - mostly Baku
  'AM',  // Armenia - limited
  'NP',  // Nepal - Kathmandu + main routes
  'RU',  // Russia - major cities, vast empty regions
  'BA',  // Bosnia and Herzegovina - partial
  'PG',  // Papua New Guinea - limited
  'MG',  // Madagascar - main routes
  'EG',  // Egypt - limited
  'PY',  // Paraguay - partial
  'GY',  // Guyana - limited
  'SR',  // Suriname - limited
  'VE',  // Venezuela - limited
  'KW',  // Kuwait - limited
  'HT',  // Haiti - limited
  'PK',  // Pakistan - very limited
])

const UNOFFICIAL = new Set<string>([
  // No Google car; only community Ari photospheres
  'CN',  // China
  'KP',  // North Korea
  'IR',  // Iran
  'CU',  // Cuba
  'TM',  // Turkmenistan
  'MM',  // Myanmar
  'AF',  // Afghanistan
  'SO',  // Somalia
  'YE',  // Yemen
  'LY',  // Libya
  'SY',  // Syria
  'ER',  // Eritrea
  'SS',  // South Sudan
  'SD',  // Sudan
  'CF',  // Central African Republic
  'TD',  // Chad
  'ML',  // Mali
  'NE',  // Niger
  'BF',  // Burkina Faso
  'DZ',  // Algeria
  'MR',  // Mauritania
  'GW',  // Guinea-Bissau
  'GN',  // Guinea
  'SL',  // Sierra Leone
  'LR',  // Liberia
  'CI',  // Cote d'Ivoire
  'TG',  // Togo
  'BJ',  // Benin
  'CM',  // Cameroon
  'GQ',  // Equatorial Guinea
  'GA',  // Gabon
  'CG',  // Republic of the Congo
  'CD',  // DR Congo
  'AO',  // Angola
  'NA',  // Namibia
  'ZM',  // Zambia
  'ZW',  // Zimbabwe
  'MW',  // Malawi
  'MZ',  // Mozambique
  'ET',  // Ethiopia
  'DJ',  // Djibouti
  'NG',  // Nigeria
  'MA',  // Morocco
  'EH',  // Western Sahara
  'BN',  // Brunei
  'MV',  // Maldives
  'IQ',  // Iraq
  'TL',  // Timor-Leste
  'GL',  // Greenland
])

const NONE = new Set<string>([
  // No Street View imagery of any kind known to exist
  // (Most uninhabited / inaccessible territories still have some Ari coverage,
  // so this set is intentionally small.)
])

export function getCoverage(code: string | undefined): CoverageCategory {
  if (!code) return 'unknown'
  const upper = code.toUpperCase()
  if (OFFICIAL.has(upper)) return 'official'
  if (MIXED.has(upper)) return 'mixed'
  if (UNOFFICIAL.has(upper)) return 'unofficial'
  if (NONE.has(upper)) return 'none'
  return 'unknown'
}

export const COVERAGE_CATEGORIES: CoverageCategory[] = [
  'official',
  'mixed',
  'unofficial',
  'none',
  'unknown',
]
