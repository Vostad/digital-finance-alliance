/**
 * IDENTITY NORMALISATION — the primitives duplicate prevention rests on.
 *
 * Pure functions, no database, no context. Every one of them is exercised
 * directly by the unit suite, because a matching bug here does not announce
 * itself: it quietly creates a second John Smith and nobody notices until two
 * people call him in the same week.
 */

/**
 * Strip a string to its comparable core: fold accents, drop punctuation,
 * collapse whitespace, lowercase.
 *
 * `Zübeyde  O'Brien-Smith` and `zubeyde obrien smith` must compare equal —
 * the same person typed by two people, one of whom had a keyboard with
 * diacritics and one of whom did not.
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Legal-form suffixes, stripped so `Temenos AG`, `TEMENOS`, and
 * `Temenos Headquarters SA` collapse to one comparable name.
 *
 * Order matters only in that longer forms must be tried first — `pvt ltd`
 * before `ltd` — or `pvt` survives as a fragment.
 */
const COMPANY_SUFFIXES = [
  "pvt ltd",
  "private limited",
  "pte ltd",
  "fz llc",
  "fz-llc",
  "fzco",
  "fze",
  "llc",
  "l l c",
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "nv",
  "bv",
  "ab",
  "as",
  "oy",
  "spa",
  "srl",
  "sarl",
  "pty",
  "co",
  "company",
  "group",
  "holdings",
  "holding",
  "bank",
  "psc",
  "pjsc",
  "jsc",
  "llp",
];

/**
 * The company match key. Suffix stripping is deliberately conservative: it
 * only removes a suffix when something is left behind, so `AG` as a whole
 * company name survives rather than normalising to the empty string and
 * matching every other suffix-only name in the table.
 *
 * `bank` is in the list, which means `ABC Bank` and `ABC` collapse together.
 * That is intended for the Gulf market this serves, where the same institution
 * is written both ways constantly — and it produces a *candidate*, not an
 * automatic merge. A human still confirms.
 */
export function normalizeCompanyName(input: string): string {
  let name = normalizeName(input);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      if (name.endsWith(` ${suffix}`)) {
        const stripped = name.slice(0, -(suffix.length + 1)).trim();
        if (stripped.length > 0) {
          name = stripped;
          changed = true;
          break;
        }
      }
    }
  }
  return name;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase();
}

/**
 * Consumer mail hosts. A person at gmail.com tells you nothing about which
 * company they work for, so these must never become company identity — one
 * `@gmail.com` domain row would silently merge every unrelated freelancer,
 * consultant and job-seeker into a single "company".
 */
const FREE_MAIL_HOSTS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
  "rediffmail.com",
  "hotmail.fr",
  "outlook.fr",
  "web.de",
  "t-online.de",
  "libero.it",
  "orange.fr",
  "free.fr",
  "sfr.fr",
  "btinternet.com",
  "comcast.net",
  "verizon.net",
  "sbcglobal.net",
  "att.net",
  "cox.net",
  "shaw.ca",
  "rogers.com",
  "bell.net",
  "emirates.net.ae",
  "eim.ae",
  "duck.com",
  "hey.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
  "hotmail.com.au",
]);

export function isFreeMailHost(domain: string): boolean {
  return FREE_MAIL_HOSTS.has(domain.toLowerCase());
}

/** A domain usable as company identity, or null. */
export function companyDomainFromEmail(email: string): string | null {
  const domain = emailDomain(normalizeEmail(email));
  if (!domain || isFreeMailHost(domain)) return null;
  return domain;
}

/** Loose, deliberately. Real addresses are stranger than any regex expects,
    and rejecting a valid one costs a lead. Deliverability is email's job. */
export function looksLikeEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * How sure we are that two records are the same. Ordered, and the order is
 * load-bearing: `certain` blocks creation outright, `strong` and `possible`
 * are shown to a human who decides.
 */
export const MATCH_CONFIDENCE = ["certain", "strong", "possible"] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCE)[number];

export function rankConfidence(c: MatchConfidence): number {
  return MATCH_CONFIDENCE.indexOf(c);
}
