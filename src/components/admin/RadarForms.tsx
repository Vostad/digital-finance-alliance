/**
 * RAILS RADAR — THE EDITING FORMS.
 *
 * Split out of the route because the route was becoming a file where a missing
 * form could hide. It did: `saveRoute` shipped with no screen, and every upsert
 * shipped able to create but never to edit — which quietly made the
 * re-verification queue decorative, since re-verifying a record IS an edit.
 *
 * THE ONE RULE EVERY FORM HERE OBEYS. A value and its source are captured
 * together, in the same row, or not at all. `SourcedRow` is the only way to
 * enter a sourced figure, and it will not let a value through without a URL —
 * the server refuses the same pair, and a CHECK constraint refuses it again
 * underneath. Three layers, because provenance is the product rather than
 * metadata about it.
 *
 * WHAT IS DELIBERATELY NOT HERE. Fields the schema holds but no V1 page renders
 * — provider description, API type, use cases — have no inputs. The database
 * can hold what the UI does not yet ask for; asking for data nobody will see is
 * how an admin surface becomes a chore that stops being filled in accurately.
 */

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button, Field, INPUT, TEXT } from "./primitives";
import {
  saveCorridor,
  saveCorridorEvent,
  saveLicence,
  saveProvider,
  saveRail,
  saveRoute,
} from "@/rpc/radar-admin";

/**
 * TODAY, AND EVERY DATE IN THESE FORMS, IN THE EDITOR'S OWN TIMEZONE.
 *
 * `toISOString()` is UTC, and that is wrong here in a way that is invisible
 * until it is embarrassing: an editor in GST+4 working at 01:30 on the 4th is
 * at 21:30 UTC on the 3rd, so every record entered late in the evening would be
 * stamped a day early. On a product whose entire claim is "verified on this
 * date, against this source", a verification date that is quietly off by one is
 * not a cosmetic bug.
 *
 * Built from the local calendar parts rather than a locale format string, so it
 * cannot be re-ordered by whatever locale the browser happens to run in — the
 * `<input type="date">` value must be exactly `YYYY-MM-DD`.
 */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = () => localDate(new Date());

/** An existing timestamptz, shown as the calendar date it falls on for the
    person reading it — the same rule, applied to a stored value. */
const asDate = (v: Date | string | null | undefined) => (v ? localDate(new Date(v)) : TODAY());
const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const join = (xs: readonly string[] | undefined) => (xs ?? []).join(", ");

type Status = "draft" | "published" | "archived";

/* ------------------------------------------------------------------ shell -- */

function FormShell({
  title,
  hint,
  busy,
  error,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  hint?: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 border border-hairline p-4">
      <div className="mb-4 border-b border-hairline pb-2">
        <h3 className={cn(TEXT.heading, "text-ink")}>{title}</h3>
        {hint ? <p className={cn(TEXT.micro, "mt-1 text-ink/55")}>{hint}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      {error ? (
        <p className={cn(TEXT.micro, "mt-4 text-[var(--accord-orange-deep)]")}>{error}</p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Button onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * A figure and the URL that backs it, captured as one thing.
 *
 * There is no arrangement of this component that submits a value with an empty
 * source: the source input is required exactly when the value is non-empty, and
 * clearing the value clears the pair. Clearing IS legitimate — a figure a
 * provider has withdrawn should go back to "Not published" rather than linger.
 */
function SourcedRow({
  label,
  hint,
  value,
  sourceUrl,
  onValue,
  onSource,
  numeric = false,
}: {
  label: string;
  hint?: string;
  value: string;
  sourceUrl: string;
  onValue: (v: string) => void;
  onSource: (v: string) => void;
  numeric?: boolean;
}) {
  const needsSource = value.trim() !== "" && sourceUrl.trim() === "";
  return (
    <>
      <Field label={label} hint={hint}>
        <input
          className={cn(INPUT, numeric && "text-right font-mono tabular-nums")}
          inputMode={numeric ? "decimal" : undefined}
          value={value}
          onChange={(e) =>
            onValue(numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)
          }
        />
      </Field>
      <Field label={`${label} — source`} required={value.trim() !== ""}>
        <input
          className={cn(INPUT, needsSource && "border-[var(--accord-orange-deep)]")}
          placeholder={value.trim() ? "https:// — required for this value" : "https://"}
          value={sourceUrl}
          onChange={(e) => onSource(e.target.value)}
        />
        {needsSource ? (
          <p className={cn(TEXT.micro, "mt-1 text-[var(--accord-orange-deep)]")}>
            A figure without its source will not publish.
          </p>
        ) : null}
      </Field>
    </>
  );
}

function StatusField({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <Field label="Status" hint="Nothing renders publicly until it is published.">
      <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value as Status)}>
        <option value="draft">draft</option>
        <option value="published">published</option>
        <option value="archived">archived</option>
      </select>
    </Field>
  );
}

/** Shared save wrapper: one busy flag, one error line, one refresh. */
function useSaver(onSaved: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await onSaved();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That change was refused.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

/* ------------------------------------------------------------------- rail -- */

export type RailRow = {
  id: string;
  name: string;
  category: "traditional" | "digital" | "blockchain" | "emerging";
  description: string | null;
  isMessagingNetwork: boolean;
  status: Status;
  sourceUrl: string | null;
  lastVerifiedAt: Date | string | null;
  lastVerifiedBy: string | null;
};

export function RailForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: RailRow | undefined;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    category: initial?.category ?? ("traditional" as RailRow["category"]),
    description: initial?.description ?? "",
    isMessagingNetwork: initial?.isMessagingNetwork ?? false,
    status: initial?.status ?? ("draft" as Status),
    sourceUrl: initial?.sourceUrl ?? "",
    lastVerifiedAt: asDate(initial?.lastVerifiedAt),
    lastVerifiedBy: initial?.lastVerifiedBy ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <FormShell
      title={initial ? `Edit rail — ${initial.name}` : "New rail"}
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        save(() =>
          saveRail({
            data: {
              id: initial?.id ?? null,
              name: f.name,
              category: f.category,
              description: f.description || null,
              isMessagingNetwork: f.isMessagingNetwork,
              status: f.status,
              sourceUrl: f.sourceUrl,
              lastVerifiedAt: f.lastVerifiedAt,
              lastVerifiedBy: f.lastVerifiedBy,
            },
          }),
        )
      }
    >
      <Field label="Name" required>
        <input className={INPUT} value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Category">
        <select
          className={INPUT}
          value={f.category}
          onChange={(e) => set("category", e.target.value as RailRow["category"])}
        >
          <option value="traditional">traditional</option>
          <option value="digital">digital</option>
          <option value="blockchain">blockchain</option>
          <option value="emerging">emerging</option>
        </select>
      </Field>
      <Field label="Description" hint="One or two sentences. Shown on the rail page.">
        <input
          className={INPUT}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field label="Source URL" required>
        <input
          className={INPUT}
          placeholder="https://"
          value={f.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
        />
      </Field>
      <Field label="Verified on" required>
        <input
          type="date"
          className={INPUT}
          value={f.lastVerifiedAt}
          onChange={(e) => set("lastVerifiedAt", e.target.value)}
        />
      </Field>
      <Field label="Verified by" hint="Defaults to you.">
        <input
          className={INPUT}
          value={f.lastVerifiedBy}
          onChange={(e) => set("lastVerifiedBy", e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2 border-l-2 border-[var(--accord-orange-deep)] pl-3">
        <label className={cn(TEXT.body, "flex items-start gap-2")}>
          <input
            type="checkbox"
            className="mt-1"
            checked={f.isMessagingNetwork}
            onChange={(e) => set("isMessagingNetwork", e.target.checked)}
          />
          <span>
            This is a <strong>messaging network</strong> — it carries instructions and does not
            settle.
            <span className={cn(TEXT.micro, "mt-1 block text-ink/55")}>
              Set this correctly. With it on, the server refuses any settlement-finality claim on a
              route using this rail unless the settlement system conferring finality is named.
            </span>
          </span>
        </label>
      </div>
      <StatusField value={f.status} onChange={(s) => set("status", s)} />
    </FormShell>
  );
}

/* --------------------------------------------------------------- provider -- */

export type ProviderRow = {
  id: string;
  name: string;
  type: string;
  website: string | null;
  custodyModel: string | null;
  apiDocumentation: string | null;
  settlementTime: string | null;
  settlementTimeSourceUrl: string | null;
  settlementHours: string | null;
  settlementHoursSourceUrl: string | null;
  settlementFee: string | null;
  settlementFeeSourceUrl: string | null;
  limits: string | null;
  limitsSourceUrl: string | null;
  status: Status;
  sourceUrl: string | null;
  lastVerifiedAt: Date | string | null;
  lastVerifiedBy: string | null;
  markets?: string[];
  assets?: string[];
  networks?: string[];
  requirements?: string[];
};

const PROVIDER_TYPES = [
  "bank",
  "psp",
  "orchestration",
  "stablecoin",
  "fx",
  "custodian",
  "exchange",
  "onramp",
] as const;

export function ProviderForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: ProviderRow | undefined;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    type: (initial?.type ?? "psp") as (typeof PROVIDER_TYPES)[number],
    website: initial?.website ?? "",
    custodyModel: initial?.custodyModel ?? "",
    apiDocumentation: initial?.apiDocumentation ?? "",
    markets: join(initial?.markets),
    assets: join(initial?.assets),
    networks: join(initial?.networks),
    requirements: join(initial?.requirements),
    settlementTime: initial?.settlementTime ?? "",
    settlementTimeSourceUrl: initial?.settlementTimeSourceUrl ?? "",
    settlementHours: initial?.settlementHours ?? "",
    settlementHoursSourceUrl: initial?.settlementHoursSourceUrl ?? "",
    settlementFee: initial?.settlementFee ?? "",
    settlementFeeSourceUrl: initial?.settlementFeeSourceUrl ?? "",
    limits: initial?.limits ?? "",
    limitsSourceUrl: initial?.limitsSourceUrl ?? "",
    status: initial?.status ?? ("draft" as Status),
    sourceUrl: initial?.sourceUrl ?? "",
    lastVerifiedAt: asDate(initial?.lastVerifiedAt),
    lastVerifiedBy: initial?.lastVerifiedBy ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <FormShell
      title={initial ? `Edit provider — ${initial.name}` : "New provider"}
      hint="Settlement figures are entered only where the provider publishes them. Leave a pair blank and the page reads “Not published”, which is the honest answer."
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        save(() =>
          saveProvider({
            data: {
              id: initial?.id ?? null,
              name: f.name,
              type: f.type,
              website: f.website || null,
              custodyModel: f.custodyModel || null,
              apiDocumentation: f.apiDocumentation || null,
              settlementTime: f.settlementTime || null,
              settlementTimeSourceUrl: f.settlementTimeSourceUrl || null,
              settlementHours: f.settlementHours || null,
              settlementHoursSourceUrl: f.settlementHoursSourceUrl || null,
              settlementFee: f.settlementFee || null,
              settlementFeeSourceUrl: f.settlementFeeSourceUrl || null,
              limits: f.limits || null,
              limitsSourceUrl: f.limitsSourceUrl || null,
              markets: split(f.markets),
              assets: split(f.assets),
              networks: split(f.networks),
              useCases: [],
              requirements: split(f.requirements),
              status: f.status,
              sourceUrl: f.sourceUrl,
              lastVerifiedAt: f.lastVerifiedAt,
              lastVerifiedBy: f.lastVerifiedBy,
            },
          }),
        )
      }
    >
      <Field label="Name" required>
        <input className={INPUT} value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Type">
        <select
          className={INPUT}
          value={f.type}
          onChange={(e) => set("type", e.target.value as (typeof PROVIDER_TYPES)[number])}
        >
          {PROVIDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Website" hint="Used for the “Contact provider” link.">
        <input
          className={INPUT}
          value={f.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </Field>
      <Field label="API documentation URL">
        <input
          className={INPUT}
          value={f.apiDocumentation}
          onChange={(e) => set("apiDocumentation", e.target.value)}
        />
      </Field>
      <Field label="Markets" hint="Comma separated.">
        <input
          className={INPUT}
          value={f.markets}
          onChange={(e) => set("markets", e.target.value)}
        />
      </Field>
      <Field label="Assets" hint="Comma separated.">
        <input className={INPUT} value={f.assets} onChange={(e) => set("assets", e.target.value)} />
      </Field>
      <Field label="Networks" hint="Comma separated.">
        <input
          className={INPUT}
          value={f.networks}
          onChange={(e) => set("networks", e.target.value)}
        />
      </Field>
      <Field label="Custody model">
        <input
          className={INPUT}
          value={f.custodyModel}
          onChange={(e) => set("custodyModel", e.target.value)}
        />
      </Field>
      <Field label="Onboarding requirements" hint="Comma separated. Shown on the provider page.">
        <input
          className={INPUT}
          value={f.requirements}
          onChange={(e) => set("requirements", e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2 mt-2 border-t border-hairline pt-3">
        <p className={cn(TEXT.label, "text-ink/55")}>Published settlement figures</p>
      </div>
      <SourcedRow
        label="Settlement time"
        value={f.settlementTime}
        sourceUrl={f.settlementTimeSourceUrl}
        onValue={(v) => set("settlementTime", v)}
        onSource={(v) => set("settlementTimeSourceUrl", v)}
      />
      <SourcedRow
        label="Settlement hours"
        value={f.settlementHours}
        sourceUrl={f.settlementHoursSourceUrl}
        onValue={(v) => set("settlementHours", v)}
        onSource={(v) => set("settlementHoursSourceUrl", v)}
      />
      <SourcedRow
        label="Fees"
        value={f.settlementFee}
        sourceUrl={f.settlementFeeSourceUrl}
        onValue={(v) => set("settlementFee", v)}
        onSource={(v) => set("settlementFeeSourceUrl", v)}
      />
      <SourcedRow
        label="Limits"
        value={f.limits}
        sourceUrl={f.limitsSourceUrl}
        onValue={(v) => set("limits", v)}
        onSource={(v) => set("limitsSourceUrl", v)}
      />
      <div className="sm:col-span-2 mt-2 border-t border-hairline pt-3">
        <p className={cn(TEXT.label, "text-ink/55")}>Provenance</p>
      </div>
      <Field label="Source URL" required>
        <input
          className={INPUT}
          placeholder="https://"
          value={f.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
        />
      </Field>
      <Field label="Verified on" required>
        <input
          type="date"
          className={INPUT}
          value={f.lastVerifiedAt}
          onChange={(e) => set("lastVerifiedAt", e.target.value)}
        />
      </Field>
      <Field label="Verified by" hint="Defaults to you.">
        <input
          className={INPUT}
          value={f.lastVerifiedBy}
          onChange={(e) => set("lastVerifiedBy", e.target.value)}
        />
      </Field>
      <StatusField value={f.status} onChange={(s) => set("status", s)} />
    </FormShell>
  );
}

/* --------------------------------------------------------------- corridor -- */

export type CorridorRow = {
  id: string;
  originCountry: string;
  originCountryCode?: string;
  originCurrency: string;
  destinationCountry: string;
  destinationCountryCode?: string;
  destinationCurrency: string;
  destinationConstraints?: string | null;
  destinationConstraintsSourceUrl?: string | null;
  status: Status;
  lastVerifiedAt: Date | string | null;
  lastVerifiedBy?: string | null;
};

export function CorridorForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: CorridorRow | undefined;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({
    originCountry: initial?.originCountry ?? "",
    originCountryCode: initial?.originCountryCode ?? "",
    originCurrency: initial?.originCurrency ?? "",
    destinationCountry: initial?.destinationCountry ?? "",
    destinationCountryCode: initial?.destinationCountryCode ?? "",
    destinationCurrency: initial?.destinationCurrency ?? "",
    destinationConstraints: initial?.destinationConstraints ?? "",
    destinationConstraintsSourceUrl: initial?.destinationConstraintsSourceUrl ?? "",
    status: initial?.status ?? ("draft" as Status),
    lastVerifiedAt: asDate(initial?.lastVerifiedAt),
    lastVerifiedBy: initial?.lastVerifiedBy ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <FormShell
      title={
        initial
          ? `Edit corridor — ${initial.originCountry} → ${initial.destinationCountry}`
          : "New corridor"
      }
      hint={
        initial
          ? "The URL slug was fixed when this corridor was created and is not regenerated — it is the identity of every inbound link."
          : "The URL slug is generated from the country names, once, and never again."
      }
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        save(() =>
          saveCorridor({
            data: {
              id: initial?.id ?? null,
              originCountry: f.originCountry,
              originCountryCode: f.originCountryCode,
              originCurrency: f.originCurrency,
              destinationCountry: f.destinationCountry,
              destinationCountryCode: f.destinationCountryCode,
              destinationCurrency: f.destinationCurrency,
              destinationConstraints: f.destinationConstraints || null,
              destinationConstraintsSourceUrl: f.destinationConstraintsSourceUrl || null,
              status: f.status,
              sourceUrl: null,
              lastVerifiedAt: f.lastVerifiedAt,
              lastVerifiedBy: f.lastVerifiedBy,
            },
          }),
        )
      }
    >
      <Field label="Origin country" required>
        <input
          className={INPUT}
          value={f.originCountry}
          onChange={(e) => set("originCountry", e.target.value)}
        />
      </Field>
      <Field label="Origin ISO" required hint="Two or three letters.">
        <input
          className={INPUT}
          maxLength={3}
          value={f.originCountryCode}
          onChange={(e) => set("originCountryCode", e.target.value)}
        />
      </Field>
      <Field label="Origin currency" required hint="Three letters.">
        <input
          className={INPUT}
          maxLength={3}
          value={f.originCurrency}
          onChange={(e) => set("originCurrency", e.target.value)}
        />
      </Field>
      <Field label="Destination country" required>
        <input
          className={INPUT}
          value={f.destinationCountry}
          onChange={(e) => set("destinationCountry", e.target.value)}
        />
      </Field>
      <Field label="Destination ISO" required>
        <input
          className={INPUT}
          maxLength={3}
          value={f.destinationCountryCode}
          onChange={(e) => set("destinationCountryCode", e.target.value)}
        />
      </Field>
      <Field label="Destination currency" required>
        <input
          className={INPUT}
          maxLength={3}
          value={f.destinationCurrency}
          onChange={(e) => set("destinationCurrency", e.target.value)}
        />
      </Field>
      <SourcedRow
        label="Destination constraints"
        hint="Regulatory constraints in the destination market. The one place prose is allowed — a constraint really is a sentence."
        value={f.destinationConstraints}
        sourceUrl={f.destinationConstraintsSourceUrl}
        onValue={(v) => set("destinationConstraints", v)}
        onSource={(v) => set("destinationConstraintsSourceUrl", v)}
      />
      <Field label="Verified on" required>
        <input
          type="date"
          className={INPUT}
          value={f.lastVerifiedAt}
          onChange={(e) => set("lastVerifiedAt", e.target.value)}
        />
      </Field>
      <Field label="Verified by" hint="Defaults to you.">
        <input
          className={INPUT}
          value={f.lastVerifiedBy}
          onChange={(e) => set("lastVerifiedBy", e.target.value)}
        />
      </Field>
      <StatusField value={f.status} onChange={(s) => set("status", s)} />
    </FormShell>
  );
}

/* ------------------------------------------------------------------ route -- */

export type RouteRow = {
  id: string;
  corridorId: string;
  providerId: string;
  railId: string;
  type: "bank" | "local" | "stablecoin" | "hybrid";
  limitMin: string | null;
  limitMinSourceUrl: string | null;
  limitMax: string | null;
  limitMaxSourceUrl: string | null;
  limitCurrency: string | null;
  settlementFinality: string | null;
  settlementSystem: string | null;
  settlementFinalitySourceUrl: string | null;
  operatingHours: string | null;
  operatingHoursSourceUrl: string | null;
  cutOff: string | null;
  cutOffSourceUrl: string | null;
  assets?: string[];
  networks?: string[];
  requirements?: string[];
  status: Status;
  sourceUrl: string | null;
  lastVerifiedAt: Date | string | null;
  lastVerifiedBy: string | null;
};

export function RouteForm({
  corridorId,
  providers,
  rails,
  initial,
  onCancel,
  onSaved,
}: {
  corridorId: string;
  providers: Array<{ id: string; name: string; status: string }>;
  rails: Array<{ id: string; name: string; status: string; isMessagingNetwork: boolean }>;
  initial?: RouteRow | undefined;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({
    providerId: initial?.providerId ?? providers[0]?.id ?? "",
    railId: initial?.railId ?? rails[0]?.id ?? "",
    type: initial?.type ?? ("bank" as RouteRow["type"]),
    limitMin: initial?.limitMin ?? "",
    limitMinSourceUrl: initial?.limitMinSourceUrl ?? "",
    limitMax: initial?.limitMax ?? "",
    limitMaxSourceUrl: initial?.limitMaxSourceUrl ?? "",
    limitCurrency: initial?.limitCurrency ?? "",
    settlementFinality: initial?.settlementFinality ?? "",
    settlementSystem: initial?.settlementSystem ?? "",
    settlementFinalitySourceUrl: initial?.settlementFinalitySourceUrl ?? "",
    operatingHours: initial?.operatingHours ?? "",
    operatingHoursSourceUrl: initial?.operatingHoursSourceUrl ?? "",
    cutOff: initial?.cutOff ?? "",
    cutOffSourceUrl: initial?.cutOffSourceUrl ?? "",
    assets: join(initial?.assets),
    networks: join(initial?.networks),
    requirements: join(initial?.requirements),
    status: initial?.status ?? ("draft" as Status),
    sourceUrl: initial?.sourceUrl ?? "",
    lastVerifiedAt: asDate(initial?.lastVerifiedAt),
    lastVerifiedBy: initial?.lastVerifiedBy ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const rail = rails.find((r) => r.id === f.railId);
  /* The ontology, surfaced before the server has to refuse it. */
  const finalityNeedsSystem =
    !!rail?.isMessagingNetwork &&
    f.settlementFinality.trim() !== "" &&
    f.settlementSystem.trim() === "";
  const limitsNeedCurrency =
    (f.limitMin.trim() !== "" || f.limitMax.trim() !== "") && f.limitCurrency.trim() === "";

  return (
    <FormShell
      title={initial ? "Edit route" : "New route"}
      hint="A route is one rail, reached through one provider, in this corridor. It publishes only when the route, the corridor, the provider and the rail are all published."
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        save(() =>
          saveRoute({
            data: {
              id: initial?.id ?? null,
              corridorId,
              providerId: f.providerId,
              railId: f.railId,
              type: f.type,
              limitMin: f.limitMin || null,
              limitMinSourceUrl: f.limitMinSourceUrl || null,
              limitMax: f.limitMax || null,
              limitMaxSourceUrl: f.limitMaxSourceUrl || null,
              limitCurrency: f.limitCurrency || null,
              settlementFinality: f.settlementFinality || null,
              settlementSystem: f.settlementSystem || null,
              settlementFinalitySourceUrl: f.settlementFinalitySourceUrl || null,
              operatingHours: f.operatingHours || null,
              operatingHoursSourceUrl: f.operatingHoursSourceUrl || null,
              cutOff: f.cutOff || null,
              cutOffSourceUrl: f.cutOffSourceUrl || null,
              assets: split(f.assets),
              networks: split(f.networks),
              requirements: split(f.requirements),
              status: f.status,
              sourceUrl: f.sourceUrl,
              lastVerifiedAt: f.lastVerifiedAt,
              lastVerifiedBy: f.lastVerifiedBy,
            },
          }),
        )
      }
    >
      <Field label="Provider" required>
        <select
          className={INPUT}
          value={f.providerId}
          onChange={(e) => set("providerId", e.target.value)}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === "published" ? "" : ` (${p.status})`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rail" required>
        <select className={INPUT} value={f.railId} onChange={(e) => set("railId", e.target.value)}>
          {rails.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.isMessagingNetwork ? " — messaging" : ""}
              {r.status === "published" ? "" : ` (${r.status})`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Route type">
        <select
          className={INPUT}
          value={f.type}
          onChange={(e) => set("type", e.target.value as RouteRow["type"])}
        >
          <option value="bank">bank</option>
          <option value="local">local</option>
          <option value="stablecoin">stablecoin</option>
          <option value="hybrid">hybrid</option>
        </select>
      </Field>
      <Field
        label="Limit currency"
        required={limitsNeedCurrency}
        hint="Three letters. Required once either limit is set."
      >
        <input
          className={cn(INPUT, limitsNeedCurrency && "border-[var(--accord-orange-deep)]")}
          maxLength={3}
          value={f.limitCurrency}
          onChange={(e) => set("limitCurrency", e.target.value)}
        />
        {limitsNeedCurrency ? (
          <p className={cn(TEXT.micro, "mt-1 text-[var(--accord-orange-deep)]")}>
            A bare number is not a limit.
          </p>
        ) : null}
      </Field>
      <SourcedRow
        label="Minimum limit"
        numeric
        value={f.limitMin}
        sourceUrl={f.limitMinSourceUrl}
        onValue={(v) => set("limitMin", v)}
        onSource={(v) => set("limitMinSourceUrl", v)}
      />
      <SourcedRow
        label="Maximum limit"
        numeric
        value={f.limitMax}
        sourceUrl={f.limitMaxSourceUrl}
        onValue={(v) => set("limitMax", v)}
        onSource={(v) => set("limitMaxSourceUrl", v)}
      />
      <SourcedRow
        label="Settlement finality"
        hint="e.g. Irrevocable · Net · Gross"
        value={f.settlementFinality}
        sourceUrl={f.settlementFinalitySourceUrl}
        onValue={(v) => set("settlementFinality", v)}
        onSource={(v) => set("settlementFinalitySourceUrl", v)}
      />
      <Field
        label="Settlement system"
        required={finalityNeedsSystem}
        hint="Which system actually confers finality."
      >
        <input
          className={cn(INPUT, finalityNeedsSystem && "border-[var(--accord-orange-deep)]")}
          value={f.settlementSystem}
          onChange={(e) => set("settlementSystem", e.target.value)}
        />
        {finalityNeedsSystem ? (
          <p className={cn(TEXT.micro, "mt-1 text-[var(--accord-orange-deep)]")}>
            {rail?.name} is a messaging network — it carries instructions and does not settle. Name
            the settlement system that confers finality, or the server will refuse this.
          </p>
        ) : null}
      </Field>
      <SourcedRow
        label="Operating hours"
        value={f.operatingHours}
        sourceUrl={f.operatingHoursSourceUrl}
        onValue={(v) => set("operatingHours", v)}
        onSource={(v) => set("operatingHoursSourceUrl", v)}
      />
      <SourcedRow
        label="Cut-off"
        value={f.cutOff}
        sourceUrl={f.cutOffSourceUrl}
        onValue={(v) => set("cutOff", v)}
        onSource={(v) => set("cutOffSourceUrl", v)}
      />
      <Field label="Assets" hint="Comma separated.">
        <input className={INPUT} value={f.assets} onChange={(e) => set("assets", e.target.value)} />
      </Field>
      <Field label="Networks" hint="Comma separated.">
        <input
          className={INPUT}
          value={f.networks}
          onChange={(e) => set("networks", e.target.value)}
        />
      </Field>
      <Field label="Requirements" hint="Comma separated. Compliance and onboarding.">
        <input
          className={INPUT}
          value={f.requirements}
          onChange={(e) => set("requirements", e.target.value)}
        />
      </Field>
      <Field label="Source URL" required>
        <input
          className={INPUT}
          placeholder="https://"
          value={f.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
        />
      </Field>
      <Field label="Verified on" required>
        <input
          type="date"
          className={INPUT}
          value={f.lastVerifiedAt}
          onChange={(e) => set("lastVerifiedAt", e.target.value)}
        />
      </Field>
      <Field label="Verified by" hint="Defaults to you.">
        <input
          className={INPUT}
          value={f.lastVerifiedBy}
          onChange={(e) => set("lastVerifiedBy", e.target.value)}
        />
      </Field>
      <StatusField value={f.status} onChange={(s) => set("status", s)} />
    </FormShell>
  );
}

/* ---------------------------------------------------------------- licence -- */

export function LicenceForm({
  providerId,
  initial,
  onCancel,
  onSaved,
}: {
  providerId: string;
  initial?:
    | {
        id: string;
        name: string;
        registerUrl: string;
        jurisdiction: string | null;
        referenceNumber: string | null;
        lastVerifiedAt: Date | string | null;
        lastVerifiedBy: string | null;
      }
    | undefined;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    registerUrl: initial?.registerUrl ?? "",
    jurisdiction: initial?.jurisdiction ?? "",
    referenceNumber: initial?.referenceNumber ?? "",
    lastVerifiedAt: asDate(initial?.lastVerifiedAt),
    lastVerifiedBy: initial?.lastVerifiedBy ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <FormShell
      title={initial ? "Edit licence" : "New licence"}
      hint="The register URL is mandatory. A licence claim about a named institution that nobody can check is the one error here with legal consequences, so the database refuses to store it."
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        save(() =>
          saveLicence({
            data: {
              id: initial?.id ?? null,
              providerId,
              name: f.name,
              registerUrl: f.registerUrl,
              jurisdiction: f.jurisdiction || null,
              referenceNumber: f.referenceNumber || null,
              lastVerifiedAt: f.lastVerifiedAt,
              lastVerifiedBy: f.lastVerifiedBy,
            },
          }),
        )
      }
    >
      <Field label="Licence name" required>
        <input className={INPUT} value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Register URL" required hint="The regulator's own register entry.">
        <input
          className={INPUT}
          placeholder="https://"
          value={f.registerUrl}
          onChange={(e) => set("registerUrl", e.target.value)}
        />
      </Field>
      <Field label="Jurisdiction">
        <input
          className={INPUT}
          value={f.jurisdiction}
          onChange={(e) => set("jurisdiction", e.target.value)}
        />
      </Field>
      <Field label="Reference number" hint="The regulator's own reference, where published.">
        <input
          className={INPUT}
          value={f.referenceNumber}
          onChange={(e) => set("referenceNumber", e.target.value)}
        />
      </Field>
      <Field label="Verified on" required>
        <input
          type="date"
          className={INPUT}
          value={f.lastVerifiedAt}
          onChange={(e) => set("lastVerifiedAt", e.target.value)}
        />
      </Field>
      <Field label="Verified by" hint="Defaults to you.">
        <input
          className={INPUT}
          value={f.lastVerifiedBy}
          onChange={(e) => set("lastVerifiedBy", e.target.value)}
        />
      </Field>
    </FormShell>
  );
}

/* ------------------------------------------------------- structural event -- */

export function CorridorEventForm({
  corridorId,
  onCancel,
  onSaved,
}: {
  corridorId: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { busy, error, save } = useSaver(onSaved);
  const [f, setF] = useState({ occurredOn: TODAY(), description: "", sourceUrl: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  return (
    <FormShell
      title="Structural change"
      hint="A licence added, a network supported, a scheme joined. Structural history only — not cost or time, which V1 does not ship."
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSave={() => save(() => saveCorridorEvent({ data: { corridorId, ...f } }))}
    >
      <Field label="Occurred on" required>
        <input
          type="date"
          className={INPUT}
          value={f.occurredOn}
          onChange={(e) => set("occurredOn", e.target.value)}
        />
      </Field>
      <Field label="Source URL" required>
        <input
          className={INPUT}
          placeholder="https://"
          value={f.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
        />
      </Field>
      <Field label="What changed" required>
        <input
          className={INPUT}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
    </FormShell>
  );
}
