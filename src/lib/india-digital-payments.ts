/**
 * RETIRED — superseded by Financial Rails Asia.
 *
 * The India Digital Payments & Fintech edition was folded into the regional
 * Asia edition rather than run alongside it, so the platform carries one Asian
 * identity instead of two competing ones. Its route redirects to
 * /forums/financial-rails-asia.
 *
 * This shim exists only so any stray import keeps compiling. Nothing in the
 * platform reads it, and it can be deleted with `git rm` whenever convenient.
 */
export { FINANCIAL_RAILS_ASIA as INDIA_DIGITAL_PAYMENTS_EVENT } from "@/lib/financial-rails-asia";
