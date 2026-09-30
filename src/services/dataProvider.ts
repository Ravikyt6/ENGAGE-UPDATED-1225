import type { Content, DB, Settings, SitePage, SitePageSlug, User, MilestoneConfig } from "@/types";
import * as local from "./localProvider";
import * as remote from "./supabaseProvider";

export function isSupabaseMode() {
  return localStorage.getItem("engage_runtime_mode") === "supabase";
}

export const dataProvider = {
  getDB: (): DB => (isSupabaseMode() ? remote.getCache() : local.getDB()),

  async loadDB() {
    return isSupabaseMode() ? remote.loadDB() : local.getDB();
  },

  saveDB(db: DB) {
    if (!isSupabaseMode()) local.saveDB(db);
  },

  ensureUser(user: User) {
    if (isSupabaseMode()) {
      return remote.ensureUser(user);
    }
    local.ensureUser(user);
    return Promise.resolve();
  },

  addContent(input: Omit<Content, "id" | "views" | "status">) {
    if (isSupabaseMode()) {
      return remote.addContent(input);
    }
    return Promise.resolve(local.addContent(input));
  },

  listContents(type?: Content["type"]) {
    const db = this.getDB();
    return db.contents.filter((c) => !type || c.type === type);
  },

  listCampaigns(id?: string) {
    const db = this.getDB();
    return db.campaigns.filter((c) => !id || c.creatorId === id);
  },

  createCampaign(input: any) {
    if (isSupabaseMode()) {
      return remote.createCampaign(input);
    }
    return Promise.resolve(local.createCampaign(input));
  },

  deleteCampaign(campaignId: string, creatorId: string) {
    if (isSupabaseMode()) return remote.deleteCampaign(campaignId, creatorId);
    return Promise.resolve(local.deleteCampaign(campaignId, creatorId));
  },

  updateMilestones(milestones: MilestoneConfig[]) {
    if (isSupabaseMode()) return remote.updateMilestones(milestones);
    return Promise.resolve(local.updateMilestones(milestones));
  },

  updateSettings(patch: Partial<Settings>) {
    if (isSupabaseMode()) {
      return remote.updateSettings(patch);
    }
    local.updateSettings(patch);
    return Promise.resolve();
  },

  qualify(campaignId: string, userId: string) {
    if (isSupabaseMode()) {
      return remote.qualify(campaignId, userId);
    }
    local.qualify(campaignId, userId);
    return Promise.resolve();
  },

  async adminListUsers(options: any = {}) {
    if (isSupabaseMode()) return remote.adminListUsers(options);
    const users = local
      .getDB()
      .users.filter(
        (u: any) =>
          (!options.search ||
            `${u.name} ${u.email} ${u.id}`
              .toLowerCase()
              .includes(String(options.search).toLowerCase())) &&
          (!options.status || (u.status || "active") === options.status),
      );
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const rows = users
      .slice((page - 1) * pageSize, page * pageSize)
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status || "active",
        createdAt: u.createdAt || null,
        emailVerified: true,
        lastActiveAt: null,
        coinBalance: Number(local.getDB().wallets[u.id]?.coins || 0),
      }));
    return { rows, total: users.length };
  },

  adminGetUserOverview(userId: string) {
    if (isSupabaseMode()) return remote.adminGetUserOverview(userId);
    const db = local.getDB();
    const u: any = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("User not found");
    const wallet: any = db.wallets[userId] || { coins: 0, earnings: 0 };
    const campaigns = db.campaigns.filter((c) => c.creatorId === userId);
    const txs = local.getWalletTransactions(userId);
    const purchased = txs
      .filter((x: any) => x.type === "purchase")
      .reduce((a: number, x: any) => a + Number(x.coins || 0), 0);
    const earned = txs
      .filter((x: any) => ["earning", "bonus", "referral"].includes(x.type))
      .reduce((a: number, x: any) => a + Number(x.coins || 0), 0);
    const spent = txs
      .filter((x: any) => x.type === "spend")
      .reduce((a: number, x: any) => a + Number(x.coins || 0), 0);
    const refunded = txs
      .filter((x: any) => x.type === "refund")
      .reduce((a: number, x: any) => a + Number(x.coins || 0), 0);
    return Promise.resolve({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status || "active",
        avatarUrl: null,
        createdAt: u.createdAt || null,
        emailVerified: true,
        emailVerifiedAt: null,
        lastSignInAt: null,
        lastActiveAt: null,
        coinBalance: wallet.coins,
      },
      coins: {
        currentBalance: wallet.coins,
        totalPurchased: purchased,
        totalEarned: earned,
        totalSpent: spent,
        totalViewerRewards: txs
          .filter((x: any) => x.type === "earning")
          .reduce((a: number, x: any) => a + Number(x.coins || 0), 0),
        campaignSpend: campaigns.reduce(
          (a, c) => a + Number(c.creationCost || 0),
          0,
        ),
        refunded,
      },
      earnings: {
        totalCoinsEarned: earned,
        usdPerCoin: 0.0002,
        totalUsdEquivalent: earned * 0.0002,
        totalWithdrawnCoins: 0,
        pendingWithdrawalCoins: 0,
        availableWithdrawalCoins: wallet.coins,
        withdrawalCount: 0,
        lastWithdrawalAt: null,
      },
      viewActivity: {
        videosWatched: 0,
        completed: 0,
        incomplete: 0,
        totalWatchSeconds: 0,
        averageWatchSeconds: 0,
        coinsEarnedFromWatching: 0,
        lastVideoWatchedAt: null,
        lastActivityAt: null,
        totalWatchHours: 0,
      },
      campaigns: {
        created: campaigns.length,
        active: campaigns.filter((c) => c.status === "active").length,
        completed: campaigns.filter((c) => c.status === "completed").length,
        paused: campaigns.filter((c) => c.status === "paused").length,
        cancelled: campaigns.filter(
          c => (c.status as string) === "cancelled"
        ).length,
        coinsSpent: campaigns.reduce(
          (a, c) => a + Number(c.creationCost || 0),
          0,
        ),
        targetUsers: campaigns.reduce(
          (a, c) => a + Number(c.targetViews || 0),
          0,
        ),
        completedUsers: campaigns.reduce(
          (a, c) => a + Number(c.qualifiedUsers || 0),
          0,
        ),
      },
    });
  },

  adminListUserTransactions(options: any) {
    if (isSupabaseMode()) return remote.adminListUserTransactions(options);
    const rows = local
      .getWalletTransactions(options.userId)
      .filter((x: any) => !options.type || x.type === options.type);
    const page = options.page || 1,
      pageSize = options.pageSize || 20;
    return Promise.resolve({
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
    });
  },
  adminListUserCampaigns(options: any) {
    if (isSupabaseMode()) return remote.adminListUserCampaigns(options);
    const rows = local
      .getDB()
      .campaigns.filter(
        (c) =>
          c.creatorId === options.userId &&
          (!options.status || c.status === options.status),
      );
    const page = options.page || 1,
      pageSize = options.pageSize || 20;
    return Promise.resolve({
      rows: rows
        .slice((page - 1) * pageSize, page * pageSize)
        .map((c) => ({
          id: c.id,
          title: c.title,
          content_title:
            local.getDB().contents.find((x) => x.id === c.contentId)?.title ||
            "—",
          target_users: c.targetViews,
          required_watch_seconds: c.requiredWatchSeconds,
          reward_per_user: c.coinRewardPerUser,
          campaign_cost: c.creationCost,
          completed_users: c.qualifiedUsers,
          status: c.status,
          created_at: c.createdAt,
        })),
      total: rows.length,
    });
  },
  adminListWithdrawals(options: any = {}) {
    if (isSupabaseMode()) return remote.adminListWithdrawals(options);
    const rows: any[] = [];
    return Promise.resolve({ rows, total: 0 });
  },
  adminWithdrawalSummary() {
    if (isSupabaseMode()) return remote.adminWithdrawalSummary();
    return Promise.resolve({ total_count: 0, pending_count: 0, processing_count: 0, completed_count: 0, rejected_count: 0, failed_count: 0, pending_coins: 0, completed_coins: 0, completed_amount: 0 });
  },
  adminUpdateWithdrawal(withdrawalId: string, status: string, referenceId = "") {
    if (isSupabaseMode()) return remote.adminUpdateWithdrawal(withdrawalId, status, referenceId);
    throw new Error("Withdrawal controls require Supabase mode.");
  },
  adminListUserWithdrawals(options: any) {
    if (isSupabaseMode()) return remote.adminListUserWithdrawals(options);
    return Promise.resolve({ rows: [], total: 0 });
  },
  adminListUserActivity(options: any) {
    if (isSupabaseMode()) return remote.adminListUserActivity(options);
    return Promise.resolve({ rows: [], total: 0 });
  },
  adminAdjustUserCoins(userId: string, amount: number, reason: string) {
    if (isSupabaseMode())
      return remote.adminAdjustUserCoins(userId, amount, reason);
    throw new Error("Admin coin adjustment requires Supabase mode.");
  },
  adminUpdateUserStatus(userId: string, status: string, reason = "") {
    if (isSupabaseMode())
      return remote.adminUpdateUserStatus(userId, status, reason);
    throw new Error("Admin status changes require Supabase mode.");
  },
  adminUpdateUserName(userId: string, name: string) {
    if (isSupabaseMode()) return remote.adminUpdateUserName(userId, name);
    throw new Error("Admin profile edits require Supabase mode.");
  },

  async requestWithdrawal(input: any) {
    if (isSupabaseMode()) return remote.requestWithdrawal(input);
    return local.requestWithdrawal(input);
  },

  async getWalletTransactions(userId: string) {
    if (!userId) return [];
    if (isSupabaseMode()) {
      return remote.getWalletTransactions(userId);
    }
    return local.getWalletTransactions(userId);
  },

  async getWatchedContentIds(userId: string) {
    if (!userId) return [];
    if (isSupabaseMode()) {
      return remote.getWatchedContentIds(userId);
    }
    return local.getWatchedContentIds(userId);
  },

  getSitePage(slug: SitePageSlug) {
    if (isSupabaseMode()) return remote.getSitePage(slug);
    return Promise.resolve(local.getSitePage(slug));
  },

  updateSitePages(pages: SitePage[]) {
    if (isSupabaseMode()) return remote.updateSitePages(pages);
    local.updateSitePages(pages);
    return Promise.resolve();
  },

  async markContentWatched(userId: string, contentId: string) {
    if (!userId || !contentId) return;
    if (isSupabaseMode()) {
      await remote.markContentWatched(userId, contentId);
      return;
    }
    local.markContentWatched(userId, contentId);
  },
};
