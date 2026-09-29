export const COIN_USD_VALUE = 0.0002;
export const PLATFORM_MARGIN_RATE = 0.15;
export const MIN_WATCH_SECONDS = 30;

export interface CampaignEconomy {
  targetUsers: number;
  requiredWatchSeconds: number;
  rewardPerUser: number;
  viewerRewardPool: number;
  campaignCost: number;
}

export function calculateCampaignEconomy(
  targetUsers: number,
  requiredWatchSeconds: number
): CampaignEconomy {
  const users = Math.floor(Number(targetUsers));
  const seconds = Math.floor(Number(requiredWatchSeconds));

  if (!Number.isFinite(users) || users <= 0) {
    throw new Error("Target users must be greater than 0.");
  }

  if (!Number.isFinite(seconds) || seconds < MIN_WATCH_SECONDS) {
    throw new Error("Required watch time must be at least 30 seconds.");
  }

  if (seconds % 30 !== 0) {
    throw new Error("Required watch time must use 30-second increments.");
  }

  const rewardPerUser = (seconds / 30) * 5;
  const viewerRewardPool = users * rewardPerUser;
  const campaignCost = Math.ceil(viewerRewardPool * (1 + PLATFORM_MARGIN_RATE));

  return {
    targetUsers: users,
    requiredWatchSeconds: seconds,
    rewardPerUser: Math.round(rewardPerUser),
    viewerRewardPool: Math.round(viewerRewardPool),
    campaignCost,
  };
}

export function formatWatchTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (!mins) return `${secs} Seconds`;
  if (!secs) return `${mins} Minute${mins === 1 ? "" : "s"}`;
  return `${mins}m ${secs}s`;
}
