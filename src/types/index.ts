export type ContentType = "video" | "shorts" | "live";

export type SitePageSlug = "privacy" | "terms" | "contact" | "about" | "help";

export interface SitePage {
  slug: SitePageSlug;
  title: string;
  content: string;
  updatedAt?: string;
}

export type CampaignStatus =
  | "draft"
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "rejected"
  | "partial_completed";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "creator";
  accountType?: "earning" | "promotion";
  provider: "email" | "google";
  status?: "active" | "suspended" | "banned";
  createdAt?: string;
  lastActiveAt?: string | null;
  emailVerified?: boolean;
}

export interface Content {
  id: string;
  type: ContentType;
  title: string;
  creator: string;
  creatorId?: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  durationSeconds: number;
  views: number;
  status: "active" | "live" | "offline";
  thumbnail?: string;
}

export interface CampaignPackage {
  id: string;
  name: string;
  priceRupees: number;
  targetViews: number;
  totalWatchMinutes: number;
  active: boolean;
  sortOrder: number;
}

export interface Campaign {
  id: string;
  creatorId: string;
  title: string;
  type: ContentType;
  contentId: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  targetViews: number;
  totalWatchMinutes: number;
  requiredWatchSeconds: number;
  currentViews: number;
  qualifiedUsers: number;
  status: CampaignStatus;
  createdAt: string;
  creationRequestId?: string;
}

export interface MilestoneConfig {
  id: string;
  views: number;
  rewardRupees: number;
  sortOrder: number;
  active: boolean;
}

export interface Settings {
  autoplayEnabled: boolean;
  adEnabled: boolean;
  socialBarEnabled: boolean;
  highRevenueBannerEnabled: boolean;
  profitablerSquareEnabled: boolean;
  monetagVignetteEnabled: boolean;
  monetagPushCreatedEnabled: boolean;
  monetagInPagePushEnabled: boolean;
  adIntervalSeconds: number;
  showAdOnEnd: boolean;
  minShortSeconds: number;
  maxShortSeconds: number;
  viewerRewardUsdPerCoin?: number;
}

export interface Wallet {
  coins: number;
  earnings: number;
  packageViews?: number;
  packageWatchMinutes?: number;
}

export type WalletTransactionType =
  | "earning"
  | "spend"
  | "purchase"
  | "bonus"
  | "refund"
  | "withdrawal"
  | "admin_adjustment"
  | "referral";

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  coins: number;
  balanceAfter: number;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

export interface DB {
  users: User[];
  contents: Content[];
  campaigns: Campaign[];
  wallets: Record<string, Wallet>;
  settings: Settings;
  milestones: MilestoneConfig[];
  packages: CampaignPackage[];
}
