/**
 * DIGITAL FINANCE DF30 — GLOBAL EDITION · 2026. The published list.
 *
 * The source of truth for /df30-global-list, and for that page only. Exactly
 * thirty people in six editorial domains of five, in the page's published
 * order — the index each person carries is their position in that sequence,
 * an editorial numbering, not a rank.
 *
 * THE ROSTER MATCHES THE SUPPLIED PORTRAIT SET ONE-TO-ONE. The thirty names
 * are the thirty files delivered in DF30/df-global; every portrait was opened
 * and visually verified against its filename before the list was built, and
 * no one has been added, removed or substituted. Roles are the public,
 * verifiable positions these leaders hold or held, with current/former
 * distinctions preserved exactly — including the four fixed by the editorial
 * brief (Pérez-Tasso, Joseph, Menon, Cipollone) and Domingo's full title.
 *
 * PORTRAITS ARE A NORMALISED SERIES. The supplied files ranged from 400×400
 * JPEGs to a 2.3 MB 1764px JPEG across five formats and every aspect ratio
 * from 0.71 to 2.33. Each was cropped to the same 4:5 editorial frame around
 * its subject's measured face position — face centred, eyes near 38% of the
 * frame, headroom preserved — then encoded as AVIF with a JPEG fallback at
 * 480w, plus 640w/960w where the source genuinely carries that resolution.
 * Sources whose 4:5 crop fell below 480px were upscaled to the 480 floor with
 * Lanczos and a gentle unsharp pass — better than leaving the browser to do
 * it — and are marked by a single-entry `widths`. The originals in
 * DF30/df-global are untouched.
 */

export type Df30Portrait = {
  /** Path stem under /media/df30/global; `-<w>.avif|jpg` appended at render. */
  stem: string;
  /** The widths that actually exist on disk — srcset lists only real files. */
  widths: number[];
};

export type Df30Person = {
  /** Editorial index across the whole list, "01"–"30". */
  index: string;
  name: string;
  /** Public, verifiable role; current/former distinctions preserved. */
  role: string;
  /** The editorial slot — "Financial Network Architect"-style. */
  slot: string;
  /** One factual sentence; no invented biography, no invented statistics. */
  note: string;
  portrait: Df30Portrait;
};

export type Df30Domain = {
  index: string;
  title: string;
  people: Df30Person[];
};

const P = (stem: string, widths: number[]): Df30Portrait => ({
  stem: `/media/df30/global/${stem}`,
  widths,
});

export const DF30_DOMAINS: Df30Domain[] = [
  {
    index: "01",
    title: "Infrastructure & Core Technology",
    people: [
      {
        index: "01",
        name: "Javier Pérez-Tasso",
        role: "CEO, Swift",
        slot: "Financial Network Architect",
        note: "Leads the cooperative messaging network connecting more than 11,000 institutions, steering it toward instant, interoperable cross-border payments.",
        portrait: P("javier-perez-tasso", [480]),
      },
      {
        index: "02",
        name: "Paul Taylor",
        role: "Founder & CEO, Thought Machine",
        slot: "Core Banking Modernizer",
        note: "Built Vault to replace decades-old core banking systems, giving banks a cloud-native foundation to run on.",
        portrait: P("paul-taylor", [480, 640]),
      },
      {
        index: "03",
        name: "Naveen Mallela",
        role: "Global Co-Head, Kinexys by J.P. Morgan",
        slot: "Tokenized Bank Money Pioneer",
        note: "Co-leads J.P. Morgan's blockchain business, taking tokenized deposits and onchain settlement from pilot to production inside a global bank.",
        portrait: P("naveen-mallela", [480]),
      },
      {
        index: "04",
        name: "Michael Shaulov",
        role: "Co-Founder & CEO, Fireblocks",
        slot: "Digital Asset Infrastructure Builder",
        note: "Runs the custody and settlement infrastructure many institutions rely on to hold and move digital assets securely.",
        portrait: P("michael-shaulov", [480]),
      },
      {
        index: "05",
        name: "Nadine Chakar",
        role: "Global Head, DTCC Digital Assets",
        slot: "Post-Trade Transformer",
        note: "Leads the digital assets arm of the world's largest post-trade infrastructure, bringing tokenized settlement into regulated market plumbing.",
        portrait: P("nadine-chakar", [480, 960]),
      },
    ],
  },
  {
    index: "02",
    title: "Financial Inclusion & Emerging Markets",
    people: [
      {
        index: "06",
        name: "Michael Joseph",
        role: "M-PESA Pioneer; Former CEO, Safaricom",
        slot: "Mobile Money Pioneer",
        note: "Took mobile money from experiment to essential infrastructure with M-PESA, changing how millions of people store and send value.",
        portrait: P("michael-joseph", [480]),
      },
      {
        index: "07",
        name: "David Vélez",
        role: "Founder & CEO, Nubank",
        slot: "Digital Banking at Scale",
        note: "Built Nubank into one of the world's largest digital banks, bringing low-cost financial services to consumers across Latin America.",
        portrait: P("david-velez", [480, 960]),
      },
      {
        index: "08",
        name: "Dare Okoudjou",
        role: "Founder & CEO, Onafriq",
        slot: "Pan-African Payments Connector",
        note: "Connects mobile wallets, banks and money-transfer operators across Africa into one interoperable payments network.",
        portrait: P("dare-okoudjou", [480]),
      },
      {
        index: "09",
        name: "Shivani Siroya",
        role: "Founder & CEO, Tala",
        slot: "Inclusive Credit Innovator",
        note: "Uses alternative data to underwrite credit for people the formal financial system does not see.",
        portrait: P("shivani-siroya", [480, 960]),
      },
      {
        index: "10",
        name: "David Arana",
        role: "Founder & CEO, Konfío",
        slot: "SME Finance Builder",
        note: "Builds data-driven credit and financial tools for the small businesses that anchor Latin American economies.",
        portrait: P("david-arana", [480]),
      },
    ],
  },
  {
    index: "03",
    title: "Regulation & Digital Public Infrastructure",
    people: [
      {
        index: "11",
        name: "Ravi Menon",
        role: "Former Managing Director, Monetary Authority of Singapore",
        slot: "Regulator of the Digital Era",
        note: "Shaped one of the world's most-watched approaches to regulating digital finance, pairing openness to innovation with institutional discipline.",
        portrait: P("ravi-menon", [480]),
      },
      {
        index: "12",
        name: "Piero Cipollone",
        role: "Member, Executive Board, European Central Bank",
        slot: "Digital Euro Leader",
        note: "Leads the European Central Bank's work on a digital euro, one of the most consequential public-money projects in the world.",
        portrait: P("piero-cipollone", [480]),
      },
      {
        index: "13",
        name: "Nandan Nilekani",
        role: "Co-Founder & Chairman, Infosys",
        slot: "Architect of India's Digital Stack",
        note: "Guided Aadhaar and the public rails beneath India Stack, showing how digital public infrastructure can reach a billion people.",
        portrait: P("nandan-nilekani", [480]),
      },
      {
        index: "14",
        name: "Dilip Asbe",
        role: "Managing Director & CEO, NPCI",
        slot: "Population-Scale Payments Leader",
        note: "Operates UPI, the real-time payments system processing billions of transactions a month and studied by central banks worldwide.",
        portrait: P("dilip-asbe", [480, 960]),
      },
      {
        index: "15",
        name: "Tommaso Mancini-Griffoli",
        role: "Division Chief, Monetary & Capital Markets, IMF",
        slot: "Digital Money Economist",
        note: "Shapes how policymakers think about central bank digital currencies, stablecoins and cross-border payments through the IMF's monetary work.",
        portrait: P("tommaso-mancini-griffoli", [480]),
      },
    ],
  },
  {
    index: "04",
    title: "Institutional Transformation",
    people: [
      {
        index: "16",
        name: "Jamie Dimon",
        role: "Chairman & CEO, JPMorganChase",
        slot: "Global Banking Leader",
        note: "Runs America's largest bank while committing it to tokenized settlement, AI at scale and modernized payments infrastructure.",
        portrait: P("jamie-dimon", [480, 640]),
      },
      {
        index: "17",
        name: "Jane Fraser",
        role: "CEO, Citi",
        slot: "Global Bank Transformer",
        note: "Leads Citi's multi-year simplification and modernization, rebuilding a global bank around technology and services.",
        portrait: P("jane-fraser", [480, 960]),
      },
      {
        index: "18",
        name: "Tan Su Shan",
        role: "CEO, DBS Bank",
        slot: "Digital-First Banking Leader",
        note: "Leads the bank widely regarded as a model of digital transformation in institutional banking.",
        portrait: P("tan-su-shan", [480]),
      },
      {
        index: "19",
        name: "Oliver Bäte",
        role: "CEO, Allianz",
        slot: "Insurance Modernizer",
        note: "Drives digital transformation across one of the world's largest insurers and asset managers.",
        portrait: P("oliver-bate", [480]),
      },
      {
        index: "20",
        name: "Jenny Johnson",
        role: "President & CEO, Franklin Templeton",
        slot: "Tokenized Funds Trailblazer",
        note: "Put a major traditional asset manager at the front of tokenized funds, running money-market fund shares on public blockchains.",
        portrait: P("jenny-johnson", [480, 960]),
      },
    ],
  },
  {
    index: "05",
    title: "Capital Markets, Digital Assets & DeFi",
    people: [
      {
        index: "21",
        name: "Adena Friedman",
        role: "Chair & CEO, Nasdaq",
        slot: "Market Technology Leader",
        note: "Runs Nasdaq as a technology company, supplying market infrastructure, surveillance and anti-financial-crime software across the industry.",
        portrait: P("adena-friedman", [480, 960]),
      },
      {
        index: "22",
        name: "Carlos Domingo",
        role: "Executive Chairman & CEO, Securitize",
        slot: "Tokenization Pioneer",
        note: "Operates the platform behind major tokenized funds, connecting institutional asset managers to onchain distribution.",
        portrait: P("carlos-domingo", [480, 960]),
      },
      {
        index: "23",
        name: "Joseph Lubin",
        role: "Co-Founder, Ethereum; Founder & CEO, Consensys",
        slot: "Programmable Finance Builder",
        note: "Helped create Ethereum and built Consensys, putting the tools of programmable finance in millions of hands.",
        portrait: P("joseph-lubin", [480, 960]),
      },
      {
        index: "24",
        name: "Stani Kulechov",
        role: "Founder & CEO, Aave",
        slot: "DeFi Pioneer",
        note: "Created one of decentralized finance's foundational lending protocols and keeps extending what open financial markets can do.",
        portrait: P("stani-kulechov", [480]),
      },
      {
        index: "25",
        name: "Vlad Tenev",
        role: "Co-Founder & CEO, Robinhood",
        slot: "Retail Markets Disruptor",
        note: "Reshaped retail investing with commission-free trading and is extending the platform into crypto and tokenized assets.",
        portrait: P("vlad-tenev", [480]),
      },
    ],
  },
  {
    index: "06",
    title: "AI, Data, Security & Financial Intelligence",
    people: [
      {
        index: "26",
        name: "Greg Ulrich",
        role: "Chief AI & Data Officer, Mastercard",
        slot: "Payments AI Leader",
        note: "Directs how one of the world's largest payment networks deploys AI across fraud, personalization and network intelligence.",
        portrait: P("greg-ulrich", [480]),
      },
      {
        index: "27",
        name: "Jonathan Levin",
        role: "Co-Founder & CEO, Chainalysis",
        slot: "Blockchain Intelligence Leader",
        note: "Built the blockchain-analysis discipline that lets institutions and governments see, trust and police onchain finance.",
        portrait: P("jonathan-levin", [480]),
      },
      {
        index: "28",
        name: "Valerie Abend",
        role: "Global Financial Services Cybersecurity Lead, Accenture",
        slot: "Financial Cyber Strategist",
        note: "Advises the world's biggest financial institutions on cyber resilience as finance becomes inseparable from software.",
        portrait: P("valerie-abend", [480]),
      },
      {
        index: "29",
        name: "Vatsa Narasimha",
        role: "CEO, OneChronos",
        slot: "AI-Optimized Markets Builder",
        note: "Runs an exchange that uses computational optimization to match trades, pointing at what AI-native market design can look like.",
        portrait: P("vatsa-narasimha", [480]),
      },
      {
        index: "30",
        name: "Zach Perret",
        role: "Co-Founder & CEO, Plaid",
        slot: "Open Finance Architect",
        note: "Built the connectivity layer linking thousands of apps to bank accounts, making open finance a practical reality.",
        portrait: P("zach-perret", [480, 960]),
      },
    ],
  },
];

/** Exactly thirty, by construction — and checked, so a bad edit fails loudly. */
export const DF30_COUNT = DF30_DOMAINS.reduce((n, d) => n + d.people.length, 0);
if (DF30_COUNT !== 30) {
  throw new Error(`DF30 must list exactly 30 people; found ${DF30_COUNT}`);
}

/** The publication's fixed metadata, locked. */
export const DF30_GLOBAL_META = {
  label: "Digital Finance DF30",
  headline: ["30 Leaders Shaping", "the Future of Finance"],
  edition: "Global Edition · 2026",
  published: "Published 15 August 2026",
  introLabel: "The People Shaping the System",
  introHeading: "Finance is being rebuilt.",
  intro:
    "Finance is being rebuilt across its infrastructure, institutions and interfaces. The DF30 recognises 30 leaders whose work is materially shaping that transition — from payments and financial infrastructure to digital assets, inclusion, regulation, AI and financial intelligence.",
  introMeta: ["30 Leaders", "6 Domains", "Global Edition", "2026"],
  listLabel: "The DF30 — Global 2026",
  methodHeading: "An editorial selection, not a popularity contest.",
  method:
    "The DF30 is an editorial selection, not a quantitative ranking or popularity contest. Leaders are selected based on demonstrable contribution, institutional influence, current relevance and the significance of their work to the evolution of finance.",
  closeHeadline: ["The financial system", "is being rebuilt."],
  closeLine: "DF30 recognises the people shaping what comes next.",
  signature: "Digital Finance Alliance",
};

export const DF30_GLOBAL_PRINCIPLES = [
  {
    title: "Contribution",
    body: "Demonstrable impact on financial systems, institutions or infrastructure.",
  },
  {
    title: "Influence",
    body: "Meaningful influence beyond an individual's organisation.",
  },
  {
    title: "Relevance",
    body: "Current contribution to the evolution of finance.",
  },
  {
    title: "Verification",
    body: "Roles and material claims independently reviewed before publication.",
  },
];
