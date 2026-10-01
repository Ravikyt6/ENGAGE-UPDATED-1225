import type { CampaignPackage } from "@/types";

export const DEFAULT_CAMPAIGN_PACKAGES: CampaignPackage[] = [
  { id: "starter", name: "Starter", priceRupees: 99, targetViews: 100, totalWatchMinutes: 60, active: true, sortOrder: 0 },
  { id: "basic", name: "Basic", priceRupees: 199, targetViews: 250, totalWatchMinutes: 150, active: true, sortOrder: 1 },
  { id: "growth", name: "Growth", priceRupees: 399, targetViews: 500, totalWatchMinutes: 300, active: true, sortOrder: 2 },
  { id: "standard", name: "Standard", priceRupees: 699, targetViews: 1000, totalWatchMinutes: 600, active: true, sortOrder: 3 },
  { id: "pro", name: "Pro", priceRupees: 1499, targetViews: 2500, totalWatchMinutes: 1500, active: true, sortOrder: 4 },
  { id: "premium", name: "Premium", priceRupees: 2499, targetViews: 5000, totalWatchMinutes: 3000, active: true, sortOrder: 5 },
  { id: "business", name: "Business", priceRupees: 3499, targetViews: 10000, totalWatchMinutes: 6000, active: true, sortOrder: 6 },
];

export function getRequiredWatchSeconds(pkg: CampaignPackage) {
  return Math.max(1, Math.ceil((pkg.totalWatchMinutes * 60) / pkg.targetViews));
}

export function formatWatchTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (!mins) return `${secs} Seconds`;
  if (!secs) return `${mins} Minute${mins === 1 ? "" : "s"}`;
  return `${mins}m ${secs}s`;
}
