import type {
  DB,
  MilestoneConfig,
  User,
  Campaign,
  Content,
  Settings,
  ContentType,
  SitePage,
  SitePageSlug,
  CampaignPackage,
} from "@/types";
import { seedDB, defaultSettings } from "@/data/seed";
import { DEFAULT_CAMPAIGN_PACKAGES, getRequiredWatchSeconds } from "@/services/campaignPackages";

const KEY = "engage_updated_db_v1";

const WATCH_HISTORY_KEY = "engage_content_watch_history_v1";

const WALLET_TRANSACTIONS_KEY = "engage_wallet_transactions_v1";
const SITE_PAGES_KEY = "engage_site_pages_v1";
const VIEW_MILESTONE_KEY = "engage_view_milestones_v1";


const COINS_PER_RUPEE = 5000;

const DEFAULT_SITE_PAGES: Record<SitePageSlug, SitePage> = {
  privacy: { slug: "privacy", title: "Privacy Policy", content: "" },
  terms: { slug: "terms", title: "Terms & Conditions", content: "" },
  contact: { slug: "contact", title: "Contact Us", content: "" },
  about: { slug: "about", title: "About ENGAGE", content: "" },
  help: { slug: "help", title: "Help & Support", content: "" },
};

export function getSitePage(slug: SitePageSlug): SitePage {
  try {
    const stored = JSON.parse(localStorage.getItem(SITE_PAGES_KEY) || "{}");
    return { ...DEFAULT_SITE_PAGES[slug], ...(stored[slug] || {}) };
  } catch {
    return DEFAULT_SITE_PAGES[slug];
  }
}

export function updateSitePages(pages: SitePage[]) {
  try {
    const current = JSON.parse(localStorage.getItem(SITE_PAGES_KEY) || "{}");
    pages.forEach((page) => { current[page.slug] = page; });
    localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(current));
  } catch {}
  return pages;
}

export function requestWithdrawal(input: any) {
  const db = getDB();
  const userId = String(input?.userId || "");
  const coins = Math.floor(Number(input?.coins || 0));
  if (!userId) throw new Error("User not found.");
  if (coins < 100) throw new Error("Minimum withdrawal is 100 coins.");
  const wallet = db.wallets[userId];
  if (!wallet || Number(wallet.coins || 0) < coins) throw new Error("Insufficient coins.");
  wallet.coins = Number(wallet.coins || 0) - coins;
  const tx = {
    id: crypto.randomUUID(), type: "withdrawal", coins, balanceAfter: wallet.coins,
    description: `Withdrawal request via ${input?.paymentMethod || "UPI"}`,
    referenceId: crypto.randomUUID(), createdAt: new Date().toISOString(),
  };
  addWalletTransaction(userId, tx);
  saveDB(db);
  return tx;
}

export function getWalletTransactions(userId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(WALLET_TRANSACTIONS_KEY) || "{}");
    return (all[userId] || []).slice(0, 100);
  } catch {
    return [];
  }
}

function addWalletTransaction(userId: string, transaction: any) {
  try {
    const all = JSON.parse(localStorage.getItem(WALLET_TRANSACTIONS_KEY) || "{}");
    all[userId] = [transaction, ...(all[userId] || [])].slice(0, 100);
    localStorage.setItem(WALLET_TRANSACTIONS_KEY, JSON.stringify(all));
  } catch {}
}

function getWatchHistory(): Record<string, string[]> {
  try {
    return JSON.parse(
      localStorage.getItem(WATCH_HISTORY_KEY) || "{}"
    );
  } catch {
    return {};
  }
}

export function getWatchedContentIds(userId: string): string[] {
  return getWatchHistory()[userId] || [];
}

export function markContentWatched(
  userId: string,
  contentId: string
) {
  if (!userId || !contentId) return;

  const history = getWatchHistory();
  const list = history[userId] || [];

  if (!list.includes(contentId)) {
    list.push(contentId);
    history[userId] = list;
    localStorage.setItem(
      WATCH_HISTORY_KEY,
      JSON.stringify(history)
    );
  }
}


function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function getDB(): DB {
  const raw = localStorage.getItem(KEY);
  if (!raw) return clone(seedDB);

  const db: DB = JSON.parse(raw);

  db.settings = {
    ...defaultSettings,
    ...db.settings,
  };
  db.milestones = Array.isArray(db.milestones) && db.milestones.length ? db.milestones : (seedDB.milestones || []);
  db.packages = Array.isArray(db.packages) && db.packages.length ? db.packages : (seedDB.packages || DEFAULT_CAMPAIGN_PACKAGES);

  db.campaigns = (db.campaigns || []).map((c: any) => ({
    ...c,
    qualifiedUsers: c.qualifiedUsers || 0,
  }));

  return db;
}

export function saveDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function ensureUser(user: User) {
  const db = getDB();

  const existing = db.users.find((u) => u.id === user.id);
  if (!existing) {
    db.users.push(user);
  } else {
    Object.assign(existing, user);
  }

  if (!db.wallets[user.id]) {
    db.wallets[user.id] = {
      coins: user.role === "creator" ? 5000 : 1000,
      earnings: 0,
      packageViews: 0,
      packageWatchMinutes: 0,
    };
  }

  saveDB(db);
}

export function addContent(
  input: Omit<Content, "id" | "views" | "status">
) {
  const db = getDB();

  const content: Content = {
    ...input,
    id: crypto.randomUUID(),
    views: 0,
    status: input.type === "live" ? "live" : "active",
  };

  db.contents.unshift(content);
  saveDB(db);
  return content;
}

export function listContents(type?: ContentType) {
  return getDB().contents.filter((c) => !type || c.type === type);
}

export function listCampaigns(userId?: string) {
  return getDB().campaigns.filter(
    (c) => !userId || c.creatorId === userId
  );
}


export function updateCampaignPackage(id: string, patch: Partial<CampaignPackage>) {
  const db = getDB();
  const pkg = (db.packages || []).find((x: CampaignPackage) => x.id === id);
  if (!pkg) throw new Error("Package not found.");
  Object.assign(pkg, patch);
  db.packages = [...(db.packages || [])].sort((a,b) => Number(a.sortOrder||0)-Number(b.sortOrder||0));
  saveDB(db);
  return pkg;
}

export function purchaseCampaignPackage(input: any) {
  const db = getDB();
  const creatorId = String(input.creatorId || "");
  const pkg = (db.packages || DEFAULT_CAMPAIGN_PACKAGES).find((x: CampaignPackage) => x.id === input.packageId || x.id === String(input.packageId));
  if (!pkg || !pkg.active) throw new Error("Selected package is unavailable.");
  const user = db.users.find((u) => u.id === creatorId);
  if (!user || (user.role !== "creator" && user.role !== "admin" && user.accountType !== "promotion")) throw new Error("Only creator accounts can buy campaign packages.");
  const wallet: any = db.wallets[creatorId] || { coins: 0, earnings: 0, packageViews: 0, packageWatchMinutes: 0 };
  wallet.packageViews = Number(wallet.packageViews || 0) + Number(pkg.targetViews || 0);
  wallet.packageWatchMinutes = Number(wallet.packageWatchMinutes || 0) + Number(pkg.totalWatchMinutes || 0);
  db.wallets[creatorId] = wallet;
  const purchases = JSON.parse(localStorage.getItem("engage_package_purchases_v1") || "{}");
  const row = { id: crypto.randomUUID(), packageId: pkg.id, packageName: pkg.name, priceRupees: pkg.priceRupees, viewsCredited: pkg.targetViews, watchMinutesCredited: pkg.totalWatchMinutes, status: "paid", createdAt: new Date().toISOString() };
  purchases[creatorId] = [row, ...(purchases[creatorId] || [])].slice(0, 50);
  localStorage.setItem("engage_package_purchases_v1", JSON.stringify(purchases));
  addWalletTransaction(creatorId, { id: crypto.randomUUID(), type: "purchase", coins: 0, balanceAfter: wallet.coins, description: `${pkg.name} package purchased: ${pkg.targetViews} views + ${pkg.totalWatchMinutes} watch minutes`, referenceId: row.id, createdAt: row.createdAt });
  saveDB(db);
  return row;
}

export function getCreatorPackagePurchases(userId: string) {
  try { const all = JSON.parse(localStorage.getItem("engage_package_purchases_v1") || "{}"); return all[userId] || []; } catch { return []; }
}

export function createCampaign(input: any) {
  const db = getDB();
  const creatorId = String(input.creatorId || "");
  const creator = db.users.find((u) => u.id === creatorId);
  if (creator && creator.role !== "admin" && creator.role !== "creator" && creator.accountType !== "promotion") {
    throw new Error("Only creator/promotion accounts can create campaigns.");
  }
  const requestId = String(input.creationRequestId || crypto.randomUUID());
  const existing = db.campaigns.find((campaign) => campaign.creationRequestId === requestId);
  if (existing) return existing;
  const targetViews = Math.floor(Number(input.targetViews || 0));
  const watchMinutes = Number(input.watchMinutes || 0);
  const wallet: any = db.wallets[creatorId] || { coins: 0, earnings: 0, packageViews: 0, packageWatchMinutes: 0 };
  if (targetViews < 1) throw new Error("Enter at least 1 view.");
  if (watchMinutes <= 0) throw new Error("Enter a valid watch-time requirement.");
  if (Number(wallet.packageViews || 0) < targetViews) throw new Error(`Insufficient package view balance. Available: ${Number(wallet.packageViews || 0).toLocaleString()} views.`);
  if (Number(wallet.packageWatchMinutes || 0) < watchMinutes) throw new Error(`Insufficient package watch-time balance. Available: ${Number(wallet.packageWatchMinutes || 0)} minutes.`);
  const requiredWatchSeconds = Math.max(1, Math.ceil((watchMinutes * 60) / targetViews));
  if (input.type === "shorts" && requiredWatchSeconds >= 60) throw new Error("This campaign requires 60 seconds or more per Short view and cannot be used for Shorts.");
  wallet.packageViews = Number(wallet.packageViews || 0) - targetViews;
  wallet.packageWatchMinutes = Number(wallet.packageWatchMinutes || 0) - watchMinutes;
  db.wallets[creatorId] = wallet;
  const campaign: Campaign = {
    id: crypto.randomUUID(), creatorId, packageId: "balance", packageName: "Package Balance", packagePrice: 0,
    title: input.title, type: input.type, contentId: input.contentId || "", targetViews, totalWatchMinutes: watchMinutes,
    requiredWatchSeconds, currentViews: 0, qualifiedUsers: 0, status: "active", createdAt: new Date().toISOString(), creationRequestId: requestId,
  };
  db.campaigns.unshift(campaign);
  addWalletTransaction(creatorId, { id: crypto.randomUUID(), type: "spend", coins: 0, balanceAfter: wallet.coins, description: `Campaign balance used: ${targetViews} views + ${watchMinutes} watch minutes`, referenceId: campaign.id, createdAt: new Date().toISOString() });
  saveDB(db);
  return campaign;
}

export function deleteCampaign(campaignId: string, creatorId: string) {
  const db = getDB();
  const campaign = db.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found.");
  if (campaign.creatorId !== creatorId) throw new Error("Unauthorized.");
  if (!["active", "paused", "pending"].includes(String(campaign.status))) {
    throw new Error("This campaign can no longer be deleted.");
  }

  const remainingUsers = Math.max(0, Number(campaign.targetViews || 0) - Number(campaign.currentViews || 0));
  const refundableCoins = 0;
  const wallet = db.wallets[creatorId] || { coins: 0, earnings: 0 };
  wallet.coins = Number(wallet.coins || 0) + refundableCoins;
  db.wallets[creatorId] = wallet;

  campaign.status = "partial_completed";

  // The campaign record remains for audit/history, but its promoted content
  // is removed so it no longer appears in viewer feeds after cancellation.
  const contentId = campaign.contentId;
  if (contentId && !db.campaigns.some((other) => other.id !== campaign.id && other.contentId === contentId)) {
    db.contents = db.contents.filter((content) => content.id !== contentId);
  }

  if (refundableCoins > 0) {
    addWalletTransaction(creatorId, {
      id: crypto.randomUUID(),
      type: "refund",
      coins: refundableCoins,
      balanceAfter: wallet.coins,
      description: `Unused campaign balance refunded: ${campaign.title}`,
      referenceId: campaign.id,
      createdAt: new Date().toISOString(),
    });
  }

  saveDB(db);
  return { campaign, refundedCoins: refundableCoins };
}

export function qualify(campaignId: string, userId: string) {
  const db = getDB();

  const viewer = db.users.find((u) => u.id === userId);
  if (viewer && viewer.role !== "admin" && viewer.accountType !== "earning") {
    throw new Error("Only earning accounts can receive viewer rewards.");
  }

  const campaign = db.campaigns.find((x) => x.id === campaignId);
  if (!campaign || campaign.status !== "active") return;
  if (campaign.creatorId === userId) return;

  const qualificationKey = `engage_campaign_qualification_${campaignId}_${userId}`;
  if (localStorage.getItem(qualificationKey) === "1") return;

  if (campaign.currentViews >= campaign.targetViews) {
    campaign.status = "completed";
    saveDB(db);
    return;
  }

  const wallet = db.wallets[userId] || { coins: 0, earnings: 0 };
  db.wallets[userId] = wallet;
  localStorage.setItem(qualificationKey, "1");

  campaign.currentViews += 1;
  campaign.qualifiedUsers += 1;

  // User-level view milestones are cumulative across qualified campaign views.
  // Each milestone is paid only once per account.
  try {
    const milestoneState = JSON.parse(
      localStorage.getItem(VIEW_MILESTONE_KEY) || "{}"
    ) as Record<string, number[]>;
    const completed = new Set<number>(milestoneState[userId] || []);
    const totalQualifiedViews = Object.keys(localStorage).filter((key) =>
      key.startsWith(`engage_campaign_qualification_`) &&
      key.endsWith(`_${userId}`)
    ).length;

    const milestones = (db.milestones || [])
      .filter((m: MilestoneConfig) => m.active !== false && Number(m.views) > 0 && Number(m.rewardRupees) > 0)
      .sort((a: MilestoneConfig, b: MilestoneConfig) => Number(a.views) - Number(b.views));

    for (const milestone of milestones) {
      if (totalQualifiedViews >= milestone.views && !completed.has(milestone.views)) {
        const milestoneCoins = milestone.rewardRupees * COINS_PER_RUPEE;
        wallet.coins += milestoneCoins;
        wallet.earnings += milestone.rewardRupees;
        addWalletTransaction(userId, {
          id: crypto.randomUUID(),
          type: "bonus",
          coins: milestoneCoins,
          balanceAfter: wallet.coins,
          description: `${milestone.views} qualified views milestone reward: ₹${milestone.rewardRupees}`,
          referenceId: `view-milestone-${milestone.views}`,
          createdAt: new Date().toISOString(),
        });
        completed.add(milestone.views);
      }
    }

    milestoneState[userId] = Array.from(completed);
    localStorage.setItem(VIEW_MILESTONE_KEY, JSON.stringify(milestoneState));
    db.wallets[userId] = wallet;
  } catch {
    // Never block the campaign reward if local milestone persistence fails.
  }

  if (campaign.currentViews >= campaign.targetViews) {
    campaign.status = "completed";
  }

  saveDB(db);
}

export function updateMilestones(milestones: MilestoneConfig[]) {
  const db = getDB();
  db.milestones = milestones.map((m, i) => ({ ...m, sortOrder: i, active: m.active !== false }));
  saveDB(db);
  return db.milestones;
}

export function updateSettings(patch: Partial<Settings>) {
  const db = getDB();

  db.settings = {
    ...db.settings,
    ...patch,
  };

  saveDB(db);
  return db.settings;
}

export type { ContentType };
