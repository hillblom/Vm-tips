/**
 * App-wide constants and configuration
 */

export const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

export const LOCALE = 'sv-SE';

/**
 * Scoring system constants
 */
export const POINTS = {
    PERFECT: 12,      // Exact score prediction
    OUTCOME: 10,      // Correct outcome but wrong score
    MIN_PARTIAL: 5,   // Minimum for partial point calculation
    MIN_DIFF: 0       // Minimum when outcome is wrong
};

/**
 * Match status constants
 */
export const MATCH_STATUS = {
    FINISHED: 'FINISHED',
    IN_PLAY: 'IN_PLAY',
    LIVE: 'LIVE',
    PAUSED: 'PAUSED',
    SCHEDULED: 'SCHEDULED'
};

export const STAGE = {
    GROUP_STAGE: 'GROUP_STAGE'
};

/**
 * Point class thresholds for styling
 */
export const POINT_CLASS = {
    PERFECT: 'green',      // 12 points
    PARTIAL: 'yellow',     // 1-11 points
    ZERO: 'red'            // 0 points
};

/**
 * Swedish team names mapping
 */
export const TEAM_NAMES_SE = {
    "Algeria": "Algeriet", "Argentina": "Argentina", "Australia": "Australien", "Austria": "Österrike",
    "Belgium": "Belgien", "Bosnia and Herzegovina": "Bosnien", "Bosnia-Herzegovina": "Bosnien", "Brazil": "Brasilien",
    "Canada": "Kanada", "Cape Verde": "Kap Verde", "Cape-Verde": "Kap Verde", "Colombia": "Colombia",
    "Croatia": "Kroatien", "Curaçao": "Curacao", "Curacao": "Curacao", "Czech Republic": "Tjeckien",
    "Czechia": "Tjeckien", "DR Kongo": "DR Kongo", "DR Congo": "DR Kongo", "Ecuador": "Ecuador", "Egypt": "Egypten",
    "El Salvador": "El Salvador", "England": "England", "France": "Frankrike", "Germany": "Tyskland",
    "Ghana": "Ghana", "Haiti": "Haiti", "Hait": "Haiti", "Iran": "Iran", "Iraq": "Irak", "Ivory Coast": "Elfenbenskusten",
    "Japan": "Japan", "Jordan": "Jordanien", "Mexico": "Mexiko", "Morocco": "Marocko",
    "Netherlands": "Nederländerna", "New Zealand": "Nya Zeeland", "Norway": "Norge", "Panama": "Panama",
    "Paraguay": "Paraguay", "Portugal": "Portugal", "Qatar": "Qatar", "Saudi Arabia": "Saudiarabien", "Saudi-Arabia": "Saudiarabien",
    "Scotland": "Skottland", "Senegal": "Senegal", "South Africa": "Sydafrika", "South Korea": "Sydkorea",
    "Spain": "Spanien", "Sweden": "Sverige", "Switzerland": "Schweiz", "Tunisia": "Tunisien",
    "Turkey": "Turkiet", "United States": "USA", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan"
};

/**
 * Team 3-letter code mapping
 */
export const NAME_TO_TLA_MAP = {
    "Algeria": "ALG", "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
    "Belgium": "BEL", "Bosnia and Herzegovina": "BIH", "Bosnia-Herzegovina": "BIH", "Brazil": "BRA",
    "Canada": "CAN", "Cape Verde": "CPV", "Cape-Verde": "CPV", "Colombia": "COL",
    "Croatia": "CRO", "Curaçao": "CUW", "Curacao": "CUW", "Czech Republic": "CZE", "Czechia": "CZE",
    "DR Congo": "COD", "DR Kongo": "COD", "Ecuador": "ECU", "Egypt": "EGY", "El Salvador": "SLV",
    "England": "ENG", "France": "FRA", "Germany": "GER", "Ghana": "GHA", "Haiti": "HAI",
    "Iran": "IRN", "Iraq": "IRQ", "Ivory Coast": "CIV", "Japan": "JPN", "Jordan": "JOR",
    "Mexico": "MEX", "Morocco": "MAR", "Netherlands": "NED", "New Zealand": "NZL",
    "Norway": "NOR", "Panama": "PAN", "Paraguay": "PAR", "Portugal": "POR", "Qatar": "QAT",
    "Saudi Arabia": "KSA", "Saudi-Arabia": "KSA", "Scotland": "SCO", "Senegal": "SEN", "South Africa": "RSA",
    "South Korea": "KOR", "Spain": "ESP", "Sweden": "SWE", "Switzerland": "SUI",
    "Tunisia": "TUN", "Turkey": "TUR", "United States": "USA", "Uruguay": "URY", "Uzbekistan": "UZB"
};

/**
 * Swedish UI strings
 */
export const I18N = {
    FULL_TIME: "Fulltid",
    IN_PLAY: "Pågår",
    UPCOMING: "Kommande",
    NO_CHANGE: "Ingen förändring",
    CLIMBED_MOST: "Klättrat mest",
    FALLEN_MOST: "Fallit mest",
    MATCHES_LEFT: "Matcher kvar",
    PLAYED_ROUNDS: "Spelade matcher",
    UPDATED: "Uppdaterad"
};
