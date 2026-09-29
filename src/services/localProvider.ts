import type {
  DB,
  User,
  Campaign,
  Content,
  Settings,
  ContentType,
} from "@/types";
import { seedDB, defaultSettings } from "@/data/seed";
import { calculateCampaignEconomy } from "@/services/campaignEconomy";

const KEY = "engage_updated_db_v1";

const WATCH_HISTORY_KEY = "engage_content_watch_history_v1";

const WALLET_TRANSACTIONS_KEY = "engage_wallet_transactions_v1";

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

  db.campaigns = (db.campaigns || []).map((c: any) => ({
    ...c,
    qualifiedUsers: c.qualifiedUsers || 0,
    coinsPaid: c.coinsPaid || 0,
    dollarsPaid: c.dollarsPaid || 0,
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

export function createCampaign(input: any) {
  const db = getDB();
  const creatorId = String(input.creatorId || "");
  const creator = db.users.find((u) => u.id === creatorId);
  if (creator && creator.role !== "admin" && creator.role !== "creator" && creator.accountType !== "promotion") {
    throw new Error("Only creator/promotion accounts can create campaigns.");
  }
  const requestId = String(input.creationRequestId || crypto.randomUUID());
  const economy = calculateCampaignEconomy(
    Number(input.targetViews),
    Number(input.requiredWatchSeconds)
  );

  const existing = db.campaigns.find(
    (campaign) => campaign.creationRequestId === requestId
  );
  if (existing) return existing;

  const wallet = db.wallets[creatorId] || {
    coins: 0,
    earnings: 0,
  };

  if (wallet.coins < economy.campaignCost) {
    throw new Error(
      `Insufficient coins. ${economy.campaignCost.toLocaleString()} coins required.`
    );
  }

  const campaign: Campaign = {
    id: crypto.randomUUID(),
    creatorId,
    title: input.title,
    type: input.type,
    contentId: input.contentId || "",
    targetViews: economy.targetUsers,
    requiredWatchSeconds: economy.requiredWatchSeconds,
    coinRewardPerUser: economy.rewardPerUser,
    dollarRewardPerUser: economy.rewardPerUser * 0.0002,
    creationCost: economy.campaignCost,
    currentViews: 0,
    qualifiedUsers: 0,
    coinsPaid: 0,
    dollarsPaid: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    creationRequestId: requestId,
  };

  // Local development mode: validate first, then perform the single deduction
  // and campaign insert as one synchronous operation.
  wallet.coins -= economy.campaignCost;
  db.wallets[creatorId] = wallet;
  addWalletTransaction(creatorId, {
    id: crypto.randomUUID(),
    type: "spend",
    coins: economy.campaignCost,
    balanceAfter: wallet.coins,
    description: `Campaign creation: ${input.title}`,
    referenceId: campaign.id,
    createdAt: new Date().toISOString(),
  });
  db.campaigns.unshift(campaign);
  saveDB(db);

  return campaign;
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

  const wallet = db.wallets[userId] || {
    coins: 0,
    earnings: 0,
  };

  wallet.coins += campaign.coinRewardPerUser;
  wallet.earnings += campaign.dollarRewardPerUser;

  db.wallets[userId] = wallet;
  addWalletTransaction(userId, {
    id: crypto.randomUUID(),
    type: "earning",
    coins: campaign.coinRewardPerUser,
    balanceAfter: wallet.coins,
    description: `Campaign viewer reward: ${campaign.title}`,
    referenceId: campaign.id,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(qualificationKey, "1");

  campaign.currentViews += 1;
  campaign.qualifiedUsers += 1;
  campaign.coinsPaid += campaign.coinRewardPerUser;
  campaign.dollarsPaid += campaign.dollarRewardPerUser;

  if (campaign.currentViews >= campaign.targetViews) {
    campaign.status = "completed";
  }

  saveDB(db);
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
