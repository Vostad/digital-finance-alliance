/**
 * IDENTITY NORMALISATION — the primitives duplicate prevention rests on.
 * Pure functions, so every case is provable without a database.
 */

import { describe, expect, it } from "vitest";

import {
  companyDomainFromEmail,
  emailDomain,
  isFreeMailHost,
  looksLikeEmail,
  normalizeCompanyName,
  normalizeEmail,
  normalizeName,
} from "../domain/identity";

describe("normalizeName", () => {
  it("folds accents, so the same person typed two ways compares equal", () => {
    expect(normalizeName("Zübeyde Öztürk")).toBe(normalizeName("Zubeyde Ozturk"));
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(normalizeName("  O'Brien-Smith,  John ")).toBe("o brien smith john");
  });

  it("is case-insensitive", () => {
    expect(normalizeName("AHMED AL MANSOURI")).toBe(normalizeName("ahmed al mansouri"));
  });
});

describe("normalizeCompanyName", () => {
  it("strips legal suffixes so one institution is one record", () => {
    const forms = ["Temenos AG", "TEMENOS", "Temenos Ltd", "Temenos Limited", "temenos  group"];
    const normalized = new Set(forms.map(normalizeCompanyName));
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe("temenos");
  });

  it("strips stacked suffixes", () => {
    expect(normalizeCompanyName("Mashreq Bank PSC")).toBe("mashreq");
    expect(normalizeCompanyName("Acme Holdings Pvt Ltd")).toBe("acme");
  });

  it("NEVER strips a name down to nothing", () => {
    /* A company genuinely called "AG" or "Bank" must keep an identity. An
       empty match key would collide with every other suffix-only name. */
    expect(normalizeCompanyName("AG")).toBe("ag");
    expect(normalizeCompanyName("Bank")).toBe("bank");
    expect(normalizeCompanyName("Ltd")).toBe("ltd");
  });

  it("does not strip a suffix that is part of a word", () => {
    expect(normalizeCompanyName("Incorporation Systems")).toBe("incorporation systems");
  });
});

describe("email handling", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  John.Smith@ABCBank.COM ")).toBe("john.smith@abcbank.com");
  });

  it("extracts the domain", () => {
    expect(emailDomain("john@abcbank.com")).toBe("abcbank.com");
    expect(emailDomain("not-an-email")).toBeNull();
    expect(emailDomain("trailing@")).toBeNull();
  });

  it("accepts real-world addresses", () => {
    for (const ok of ["a@b.co", "first.last+tag@sub.example.co.uk", "x_y-z@a-b.io"]) {
      expect(looksLikeEmail(ok)).toBe(true);
    }
  });

  it("rejects what is plainly not an address", () => {
    for (const bad of ["", "no-at-sign", "@leading.com", "trailing@", "spaces in@it.com", "a@b"]) {
      expect(looksLikeEmail(bad)).toBe(false);
    }
  });
});

describe("free mail hosts must never become company identity", () => {
  it.each(["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "proton.me", "hotmail.co.uk"])(
    "%s is recognised as a consumer host",
    (host) => {
      expect(isFreeMailHost(host)).toBe(true);
    },
  );

  it("a corporate domain is not", () => {
    expect(isFreeMailHost("temenos.com")).toBe(false);
    expect(isFreeMailHost("mashreqbank.com")).toBe(false);
  });

  it("COMPANY DOMAIN IS NULL FOR A CONSUMER ADDRESS", () => {
    /* The failure this prevents: one @gmail.com domain row silently merging
       every unrelated freelancer into a single "company". */
    expect(companyDomainFromEmail("someone@gmail.com")).toBeNull();
    expect(companyDomainFromEmail("someone@temenos.com")).toBe("temenos.com");
  });

  it("is case-insensitive about the host", () => {
    expect(companyDomainFromEmail("Someone@GMAIL.com")).toBeNull();
  });
});
