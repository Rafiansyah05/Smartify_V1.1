/**
 * Re-export hanya kode client-safe. Untuk kuota DB gunakan ./quota.server.ts di Route Handler.
 */
export {
  FREE_TRIAL_MAX_QUESTIONS,
  FREE_MAX_GENERATES_PER_24H,
  PREMIUM_MAX_QUESTIONS,
  type Plan,
  isPremiumEffective,
} from './plan';
