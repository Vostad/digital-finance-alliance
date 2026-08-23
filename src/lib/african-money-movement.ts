/**
 * RETIRED — superseded by Financial Rails Africa.
 *
 * The African Money Movement edition was folded into the regional Africa
 * edition rather than run alongside it, so the platform carries one African
 * identity instead of two competing ones. Its route redirects to
 * /forums/financial-rails-africa.
 *
 * This shim exists only so any stray import keeps compiling. Nothing in the
 * platform reads it, and it can be deleted with `git rm` whenever convenient.
 */
export { FINANCIAL_RAILS_AFRICA as AFRICAN_MONEY_EVENT } from "@/lib/financial-rails-africa";
