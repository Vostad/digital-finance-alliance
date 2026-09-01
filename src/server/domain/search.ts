/**
 * GLOBAL SEARCH — §14. People · companies · opportunities · events · team
 * members, by name, company, email or phone.
 *
 * **Every result respects permissions, and they are not the same permissions.**
 * The directory is open to every active user (§2 — you cannot be told to find
 * the existing person and also prevented from seeing them). Opportunities are
 * scoped. User records are projected per role. One search box, three different
 * rules underneath, applied per section rather than once at the end.
 */

import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";

import {
  companies,
  editions,
  events,
  opportunities,
  people,
  personEmails,
  users,
} from "../db/schema";
import type { ScopedQuery } from "../auth/scoped";
import type { AuthContext } from "../auth/permissions";
import { USER_PUBLIC_FIELDS, visibleUserFields } from "../auth/permissions";
import { normalizeName } from "./identity";

export type SearchResults = {
  people: {
    id: string;
    fullName: string;
    jobTitle: string | null;
    companyName: string | null;
    email: string | null;
  }[];
  companies: { id: string; name: string; country: string | null; peopleCount: number }[];
  opportunities: {
    id: string;
    function: string;
    stageKey: string;
    personName: string;
    companyName: string | null;
    editionName: string;
    ownerName: string | null;
  }[];
  events: { id: string; name: string; editionName: string; city: string | null }[];
  /** Projected per §Gate-2: an Admin resolves id and full name for a Super
      Admin and nothing else. The projection is applied HERE, not in the UI. */
  users: { id: string; fullName: string; role?: string; email?: string }[];
  term: string;
};

const EMPTY = (term: string): SearchResults => ({
  people: [],
  companies: [],
  opportunities: [],
  events: [],
  users: [],
  term,
});

export async function globalSearch(
  q: ScopedQuery,
  ctx: AuthContext,
  term: string,
  perSection = 8,
): Promise<SearchResults> {
  const needle = term.trim();
  /* Two characters is the shortest useful query. One matches most of the
     database and returns a list nobody can read. */
  if (needle.length < 2) return EMPTY(needle);

  const normalized = `%${normalizeName(needle)}%`;
  const raw = `%${needle.toLowerCase()}%`;

  const [peopleRows, companyRows, opportunityRows, eventRows, userRows] = await Promise.all([
    q.directory
      .select({
        id: people.id,
        fullName: people.fullName,
        jobTitle: people.jobTitle,
        companyName: companies.name,
        email: sql<string | null>`(
          select pe.email from person_emails pe
          where pe.person_id = ${people.id}
          order by pe.is_primary desc limit 1
        )`,
      })
      .from(people)
      .leftJoin(companies, eq(companies.id, people.companyId))
      .where(
        and(
          isNull(people.mergedIntoId),
          or(
            ilike(people.normalizedName, normalized),
            ilike(people.phone, raw),
            ilike(companies.normalizedName, normalized),
            sql`exists (
              select 1 from person_emails pe
              where pe.person_id = ${people.id} and lower(pe.email) like ${raw}
            )`,
          ),
        ),
      )
      .limit(perSection),

    q.directory
      .select({
        id: companies.id,
        name: companies.name,
        country: companies.country,
        peopleCount: sql<number>`(
          select count(*)::int from people p
          where p.company_id = ${companies.id} and p.merged_into_id is null
        )`,
      })
      .from(companies)
      .where(
        and(
          isNull(companies.mergedIntoId),
          or(
            ilike(companies.normalizedName, normalized),
            sql`exists (
              select 1 from company_domains cd
              where cd.company_id = ${companies.id} and lower(cd.domain) like ${raw}
            )`,
          ),
        ),
      )
      .limit(perSection),

    /* Scoped. A Team Member searching a company name finds their own
       workstreams on it and not a colleague's. */
    q.directory
      .select({
        id: opportunities.id,
        function: opportunities.function,
        stageKey: opportunities.stageKey,
        personName: people.fullName,
        companyName: companies.name,
        editionName: editions.name,
        ownerName: users.fullName,
      })
      .from(opportunities)
      .innerJoin(people, eq(people.id, opportunities.personId))
      .innerJoin(editions, eq(editions.id, opportunities.editionId))
      .leftJoin(companies, eq(companies.id, opportunities.companyId))
      .leftJoin(users, eq(users.id, opportunities.ownerId))
      .where(
        q.where.opportunities(
          and(
            isNull(opportunities.archivedAt),
            or(
              ilike(people.normalizedName, normalized),
              ilike(companies.normalizedName, normalized),
            ),
          ),
        ),
      )
      .limit(perSection),

    q.directory
      .select({
        id: events.id,
        name: events.name,
        editionName: editions.name,
        city: editions.city,
      })
      .from(editions)
      .innerJoin(events, eq(events.id, editions.eventId))
      .where(or(ilike(events.name, raw), ilike(editions.name, raw), ilike(editions.city, raw)))
      .limit(perSection),

    q.directory
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(or(ilike(users.fullName, raw), ilike(users.email, raw)))
      .limit(perSection),
  ]);

  /**
   * The user projection, applied per row.
   *
   * `visibleUserFields` already encodes the rule — an Admin gets id and full
   * name for a Super Admin, everything for anyone else, and every role gets
   * their own record in full. Filtering here rather than in the query keeps
   * one implementation of that rule instead of two that drift.
   */
  const projectedUsers = userRows.map((row) => {
    const allowed = visibleUserFields(ctx, { id: row.id, role: row.role });
    const projected: SearchResults["users"][number] = { id: row.id, fullName: row.fullName };
    if (allowed !== USER_PUBLIC_FIELDS) {
      projected.role = row.role;
      projected.email = row.email;
    }
    return projected;
  });

  return {
    people: peopleRows,
    companies: companyRows,
    opportunities: opportunityRows,
    events: eventRows,
    users: projectedUsers,
    term: needle,
  };
}
