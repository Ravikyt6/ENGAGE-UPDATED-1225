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
  | "rejected";

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

export interface Campaign {
  id: string;
  creatorId: string;
  title: string;
  type: ContentType;
  contentId: string;
  targetViews: number;
  requiredWatchSeconds: number;
  coinRewardPerUser: number;
  dollarRewardPerUser: number;
  creationCost: number;
  currentViews: number;
  qualifiedUsers: number;
  coinsPaid: number;
  dollarsPaid: number;
  status: CampaignStatus;
  createdAt: string;
  creationRequestId?: string;
}

export interface Settings {
  rewardPerUser: number;
  campaignCreationCost: number;
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
}
