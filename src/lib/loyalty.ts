/**
 * Loyalty card: after `every` completed visits, the next visit is the reward.
 * A full cycle is every + 1 visits (N paid + 1 reward), so once the reward visit
 * is completed the card starts again from zero. Nothing is stored per customer;
 * everything comes from bookings marked "completed".
 */
export interface LoyaltyConfig {
  every: number;
  reward: string;
}

export interface LoyaltyProgress extends LoyaltyConfig {
  visits: number;
  /** Filled stamps on the current card (0..every). */
  stamps: number;
  /** True when the customer's next visit is the reward. */
  ready: boolean;
  /** Visits still needed before the reward. */
  left: number;
  /** Rewards already used. */
  redeemed: number;
}

export const DEFAULT_LOYALTY: LoyaltyConfig = { every: 5, reward: "الحلاقة السادسة مجاناً" };

/** Shop settings, falling back to defaults when the loyalty columns don't exist yet. Null when switched off. */
export function loyaltyConfig(shop: { loyalty_every?: number | null; loyalty_reward?: string | null }): LoyaltyConfig | null {
  const every = shop.loyalty_every ?? DEFAULT_LOYALTY.every;
  if (!every || every <= 0) return null;
  return { every, reward: shop.loyalty_reward?.trim() || DEFAULT_LOYALTY.reward };
}

export function loyaltyProgress(visits: number, cfg: LoyaltyConfig): LoyaltyProgress {
  const cycle = cfg.every + 1;
  const pos = visits % cycle;
  return {
    ...cfg,
    visits,
    stamps: pos,
    ready: pos === cfg.every,
    left: Math.max(cfg.every - pos, 0),
    redeemed: Math.floor(visits / cycle),
  };
}
