# Corridor entry sheet — Rails Radar

A gathering worksheet for **one complete corridor**: one rail, one provider with its licences,
the corridor, and one route. Fields are listed in the **exact order the forms ask for them**, so
you can fill this in offline and then type it straight through.

First corridor: **UAE → India**. The identity fields are filled in below; everything else is
blank on purpose.

---

## Read this first — the three things the form will reject

The form highlights each of these as you type, the server refuses it again, and a CHECK
constraint refuses it a third time. Gather so none of them can bite.

**1 · A figure without its source.**
Every sourced field is a **pair**: the value, and the URL that backs it. Enter one without the
other and it will not save. Leaving *both* blank is always fine and always correct — the page
then reads "Not published", which is the honest answer and the whole point of the product.
→ *So: never write a number in this sheet without writing its URL on the line underneath.*

**2 · A limit without its currency.**
Set a minimum or a maximum and **Limit currency becomes mandatory**. A bare number is not a
limit.
→ *So: if you record any limit, record the currency it is denominated in.*

**3 · Finality on a messaging network without naming the settlement system.**
If the rail is flagged as a messaging network, you may not claim settlement finality on a route
using it unless you also name the settlement system that actually confers finality. The rail
carries instructions; something underneath settles.
→ *So: if the rail is a messaging network, find out what settles beneath it — or leave finality
blank.*

## What counts as a source

- ✅ the provider's own published documentation, terms, or pricing page
- ✅ a scheme or system operator's rulebook
- ✅ a regulator's register entry
- ❌ a news article, a blog, a comparison site, an aggregator, a PDF you cannot link to
- ❌ anything you were told rather than can link to

Every URL must start `http://` or `https://` and should point at the **specific page** carrying
the claim, not a homepage.

## Order of entry — forced, because each references the last

**1. Rail → 2. Provider (+ its licences) → 3. Corridor → 4. Route**

A route selects a provider and a rail from what already exists, so it is entered last.

---

## 1 · RAIL

*Admin → Radar → Rails → New rail*

| # | Field | | Your answer |
|---|---|---|---|
| 1 | **Name** | **required** | |
| 2 | Category | one of: `traditional` · `digital` · `blockchain` · `emerging` | |
| 3 | Description | one or two sentences; shown on the rail page | |
| 4 | **Source URL** | **required** — scheme rulebook, operator page, or regulator | |
| 5 | **Verified on** | **required** — defaults to today | |
| 6 | Verified by | defaults to you | |
| 7 | **Is a messaging network?** | ☐ tick if it carries instructions and does **not** settle | |
| 8 | Status | `draft` while checking → `published` | |

> **Field 7 is the one to get right.** It is not cosmetic: ticking it changes what every route on
> this rail is allowed to claim. If the rail settles value itself, leave it unticked.

*Repeat this block for each rail in the corridor.*

---

## 2 · PROVIDER

*Admin → Radar → Providers → New provider*

| # | Field | | Your answer |
|---|---|---|---|
| 1 | **Name** | **required** | |
| 2 | Type | `bank` · `psp` · `orchestration` · `stablecoin` · `fx` · `custodian` · `exchange` · `onramp` | |
| 3 | Website | used for the "Contact provider" link | |
| 4 | API documentation URL | | |
| 5 | Markets | comma separated | |
| 6 | Assets | comma separated | |
| 7 | Networks | comma separated | |
| 8 | Custody model | | |
| 9 | Onboarding requirements | comma separated | |

**Published settlement figures — each is a pair. Both boxes, or neither.**

| # | Field | Value | Source URL |
|---|---|---|---|
| 10 | Settlement time | | |
| 11 | Settlement hours | | |
| 12 | Fees | | |
| 13 | Limits | | |

| # | Field | | Your answer |
|---|---|---|---|
| 14 | **Source URL** | **required** — for the provider record itself | |
| 15 | **Verified on** | **required** | |
| 16 | Verified by | defaults to you | |
| 17 | Status | `draft` → `published` | |

> Most providers publish none of fields 10–13. That is expected. Leave the pair blank and the
> profile reads "Not published" — do **not** reach for a figure from a comparison site to fill it.

### 2a · LICENCES — one block per licence

*Providers → (the provider) → Licences → Add licence*

| # | Field | | Licence 1 | Licence 2 |
|---|---|---|---|---|
| 1 | **Licence name** | **required** | | |
| 2 | **Register URL** | **required — the regulator's own entry** | | |
| 3 | Jurisdiction | | | |
| 4 | Reference number | the regulator's own reference, where published | | |
| 5 | **Verified on** | **required** | | |
| 6 | Verified by | defaults to you | | |

> **Field 2 has no way around it.** A licence cannot be stored without the register entry it
> appears on — the database refuses it. This is the one field with legal consequences: it is a
> claim about a named institution's regulatory standing, and it has to be checkable in one click.
> If you cannot find the register entry, **do not record the licence.**

---

## 3 · CORRIDOR

*Admin → Radar → Corridors → New corridor*

| # | Field | | Your answer |
|---|---|---|---|
| 1 | **Origin country** | **required** | `United Arab Emirates` |
| 2 | **Origin ISO** | **required** — 2–3 letters | `AE` |
| 3 | **Origin currency** | **required** — 3 letters | `AED` |
| 4 | **Destination country** | **required** | `India` |
| 5 | **Destination ISO** | **required** | `IN` |
| 6 | **Destination currency** | **required** | `INR` |
| 7 | Destination constraints — **value** | regulatory constraints in the destination market | |
| 7 | Destination constraints — **source URL** | required if you fill the value | |
| 8 | **Verified on** | **required** | |
| 9 | Verified by | defaults to you | |
| 10 | Status | `draft` → `published` | |

> Field 7 is the **one place prose is allowed**, because a constraint genuinely is a sentence.
> It still needs a source.
>
> The URL slug (`united-arab-emirates-to-india`) is generated **once**, on creation, from the
> country names — and never regenerated, because it is the identity of every inbound link. Get
> the country names right the first time.

---

## 4 · ROUTE

*Admin → Radar → Corridors → open the corridor → New route*

| # | Field | | Your answer |
|---|---|---|---|
| 1 | **Provider** | **required** — picked from those entered above | |
| 2 | **Rail** | **required** — picked from those entered above | |
| 3 | Route type | `bank` · `local` · `stablecoin` · `hybrid` | |
| 4 | **Limit currency** | **required if either limit below is set** | |

**Sourced pairs — both boxes, or neither.**

| # | Field | Value | Source URL |
|---|---|---|---|
| 5 | Minimum limit | | |
| 6 | Maximum limit | | |
| 7 | Settlement finality (e.g. Irrevocable · Net · Gross) | | |
| 9 | Operating hours | | |
| 10 | Cut-off | | |

| # | Field | | Your answer |
|---|---|---|---|
| 8 | **Settlement system** | **required if the rail is a messaging network and you set finality** | |
| 11 | Assets | comma separated | |
| 12 | Networks | comma separated | |
| 13 | Requirements | comma separated — compliance and onboarding | |
| 14 | **Source URL** | **required** | |
| 15 | **Verified on** | **required** | |
| 16 | Verified by | defaults to you | |
| 17 | Status | `draft` → `published` | |

> **A route only appears publicly when the route, the corridor, the provider AND the rail are all
> published.** If the corridor page looks empty after entry, one of the four is still `draft`.

---

## Optional · STRUCTURAL HISTORY

*Corridors → open the corridor → Structural change*

| # | Field | | Your answer |
|---|---|---|---|
| 1 | **Occurred on** | **required** | |
| 2 | **Source URL** | **required** | |
| 3 | **What changed** | **required** | |

> Structural only — a licence added, a network supported, a scheme joined. **Not** cost or time
> changes; V1 does not ship those.

---

## Before you start typing

- [ ] Every figure I am recording has a URL next to it
- [ ] Every licence has its **register** URL, not the provider's own page
- [ ] If I recorded a limit, I recorded its currency
- [ ] For each messaging-network rail, I know what settles underneath it — or I am leaving
      finality blank
- [ ] Every URL points at the specific page carrying the claim
- [ ] Where a provider publishes nothing, I have left it blank rather than found a number
      elsewhere

**Leaving a field blank is never a failure.** "Not published" is a finding, and it is the
finding that makes every figure that *is* published worth trusting.
