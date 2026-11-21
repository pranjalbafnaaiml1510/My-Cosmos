"""Country name normalisation for affiliation metadata. Never used to infer a country from text."""
import re

# ISO 3166-1 alpha-2 codes for countries likely to appear in space-research affiliations.
ISO2 = {
    "united states": "US", "china": "CN", "india": "IN", "germany": "DE", "united kingdom": "GB", "japan": "JP",
    "france": "FR", "italy": "IT", "canada": "CA", "australia": "AU", "south korea": "KR", "spain": "ES",
    "netherlands": "NL", "brazil": "BR", "russia": "RU", "switzerland": "CH", "sweden": "SE", "norway": "NO",
    "denmark": "DK", "finland": "FI", "belgium": "BE", "austria": "AT", "poland": "PL", "czech republic": "CZ",
    "portugal": "PT", "greece": "GR", "ireland": "IE", "israel": "IL", "turkey": "TR", "iran": "IR",
    "united arab emirates": "AE", "saudi arabia": "SA", "egypt": "EG", "south africa": "ZA", "nigeria": "NG",
    "kenya": "KE", "mexico": "MX", "argentina": "AR", "chile": "CL", "colombia": "CO", "peru": "PE",
    "taiwan": "TW", "hong kong": "HK", "singapore": "SG", "malaysia": "MY", "indonesia": "ID", "thailand": "TH",
    "vietnam": "VN", "philippines": "PH", "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK", "nepal": "NP",
    "new zealand": "NZ", "ukraine": "UA", "romania": "RO", "hungary": "HU", "slovakia": "SK", "slovenia": "SI",
    "croatia": "HR", "serbia": "RS", "bulgaria": "BG", "estonia": "EE", "latvia": "LV", "lithuania": "LT",
    "luxembourg": "LU", "iceland": "IS", "kazakhstan": "KZ", "uzbekistan": "UZ", "algeria": "DZ", "morocco": "MA",
    "tunisia": "TN", "ethiopia": "ET", "ghana": "GH", "qatar": "QA", "kuwait": "KW", "oman": "OM", "jordan": "JO",
    "lebanon": "LB", "iraq": "IQ", "venezuela": "VE", "ecuador": "EC", "uruguay": "UY", "bolivia": "BO",
    "cuba": "CU", "costa rica": "CR", "belarus": "BY", "armenia": "AM", "azerbaijan": "AZ", "georgia": "GE",
    "cyprus": "CY", "malta": "MT", "north korea": "KP", "mongolia": "MN", "bhutan": "BT", "myanmar": "MM",
    "cambodia": "KH", "laos": "LA", "brunei": "BN", "angola": "AO", "rwanda": "RW", "uganda": "UG", "tanzania": "TZ",
}
ALIASES = {
    "usa": "united states", "us": "united states", "u.s.": "united states", "u.s.a.": "united states",
    "united states of america": "united states", "america": "united states",
    "uk": "united kingdom", "u.k.": "united kingdom", "great britain": "united kingdom", "england": "united kingdom",
    "scotland": "united kingdom", "wales": "united kingdom",
    "prc": "china", "people's republic of china": "china", "p.r. china": "china", "mainland china": "china",
    "korea": "south korea", "republic of korea": "south korea", "korea, republic of": "south korea",
    "russian federation": "russia", "the netherlands": "netherlands", "holland": "netherlands",
    "czechia": "czech republic", "uae": "united arab emirates", "türkiye": "turkey", "turkiye": "turkey",
    "viet nam": "vietnam", "iran, islamic republic of": "iran", "deutschland": "germany",
}
DISPLAY = {"united states": "United States", "united kingdom": "United Kingdom", "united arab emirates": "United Arab Emirates"}


def normalize_country(raw: str | None) -> tuple[str | None, str | None]:
    """Return (display name, ISO2 or None). Unknown names are kept as given, title-cased."""
    if not raw or not str(raw).strip():
        return None, None
    key = re.sub(r"\s+", " ", str(raw).strip().lower())
    key = ALIASES.get(key, key)
    code = ISO2.get(key)
    if code:
        return DISPLAY.get(key, key.title()), code
    return str(raw).strip(), None


def flag(code: str | None) -> str:
    """Regional-indicator flag emoji for an ISO2 code ("" when unknown)."""
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code.upper()) if code and len(code) == 2 else ""
