import type { DB, User, Content, Campaign, Settings } from "@/types";
import { supabase } from "./supabase";
import { seedDB, defaultSettings } from "@/data/seed";
import { calculateCampaignEconomy } from "@/services/campaignEconomy";

let remoteCache: DB = {
  users: [],
  contents: [],
  campaigns: [],
  wallets: {},
  settings: defaultSettings,
};

export function isLiveMode() {
  return localStorage.getItem("engage_runtime_mode") === "supabase";
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

export async function loadDB(): Promise<DB> {
  const sb = requireSupabase();

  const [profiles, wallets, contents, campaigns, settings] =
    await Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: false }),
      sb.from("wallets").select("*"),
      sb.from("contents").select("*").order("created_at", { ascending: false }),
      sb.from("campaigns").select("*").order("created_at", { ascending: false }),
      sb.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

  const error =
    profiles.error ||
    wallets.error ||
    contents.error ||
    campaigns.error ||
    settings.error;

  if (error) throw error;

  const db: DB = {
    users: (profiles.data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatar_url || null,
      role: u.role,
      accountType: u.account_type || "earning",
      provider: "email",
    })),
    contents: (contents.data || []).map((c: any) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      creator: c.creator_name,
      creatorId: c.creator_id || undefined,
      youtubeUrl: c.youtube_url,
      youtubeVideoId: c.youtube_video_id,
      durationSeconds: c.duration_seconds || 0,
      views: c.views || 0,
      status: c.status,
      thumbnail: `https://img.youtube.com/vi/${c.youtube_video_id}/hqdefault.jpg`,
    })),
    campaigns: (campaigns.data || []).map((c: any) => ({
      id: c.id,
      creatorId: c.creator_id,
      title: c.title,
      type: c.type,
      contentId: c.content_id || "",
      targetViews: c.target_views,
      requiredWatchSeconds: c.required_watch_seconds,
      coinRewardPerUser: Number(c.coin_reward_per_user || 0),
      dollarRewardPerUser: Number(c.dollar_reward_per_user || 0),
      creationCost: Number(c.creation_cost || 0),
      currentViews: c.current_views || 0,
      qualifiedUsers: c.qualified_users || 0,
      coinsPaid: Number(c.coins_paid || 0),
      dollarsPaid: Number(c.dollars_paid || 0),
      status: c.status,
      createdAt: c.created_at,
      creationRequestId: c.creation_request_id || undefined,
    })),
    wallets: Object.fromEntries(
      (wallets.data || []).map((w: any) => [
        w.user_id,
        {
          coins: Number(w.coins || 0),
          earnings: Number(w.earnings || 0),
        },
      ])
    ),
    settings: {
      ...defaultSettings,
      ...(settings.data || {}),
      rewardPerUser: Number(settings.data?.reward_per_user ?? defaultSettings.rewardPerUser),
      campaignCreationCost: Number(
        settings.data?.campaign_creation_cost ??
          defaultSettings.campaignCreationCost
      ),
      autoplayEnabled: Boolean(
        settings.data?.autoplay_enabled ?? defaultSettings.autoplayEnabled
      ),
      adEnabled: Boolean(
        settings.data?.ad_enabled ?? false
      ),
      socialBarEnabled: Boolean(
        settings.data?.social_bar_enabled ?? false
      ),
      highRevenueBannerEnabled: Boolean(
        settings.data?.high_revenue_banner_enabled ?? false
      ),
      profitablerSquareEnabled: Boolean(
        settings.data?.profitabler_square_enabled ?? false
      ),
      monetagVignetteEnabled: Boolean(
        settings.data?.monetag_vignette_enabled ?? false
      ),
      monetagPushCreatedEnabled: Boolean(
        settings.data?.monetag_push_created_enabled ?? false
      ),
      monetagInPagePushEnabled: Boolean(
        settings.data?.monetag_in_page_push_enabled ?? false
      ),
      adIntervalSeconds: Number(
        settings.data?.ad_interval_seconds ?? defaultSettings.adIntervalSeconds
      ),
      showAdOnEnd: Boolean(
        settings.data?.show_ad_on_end ?? false
      ),
      minShortSeconds: Number(
        settings.data?.min_short_seconds ?? defaultSettings.minShortSeconds
      ),
      maxShortSeconds: Number(
        settings.data?.max_short_seconds ?? defaultSettings.maxShortSeconds
      ),
      viewerRewardUsdPerCoin: Number(
        settings.data?.viewer_reward_usd_per_coin ?? 0.0002
      ),
    },
  };

  remoteCache = db;
  return db;
}

export function getCache() {
  return remoteCache;
}

export async function ensureUser(_user: User) {
  // Supabase creates the profile and wallet from the auth-user trigger.
  // Wallet balances are intentionally not upserted from the browser.
}


export async function requestWithdrawal(input: any) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("request_withdrawal", {
    p_user_id: input.userId,
    p_coins: Math.floor(Number(input.coins || 0)),
    p_payment_method: input.paymentMethod || "UPI",
    p_payment_details: String(input.paymentDetails || ""),
  });
  if (error) throw error;
  await loadDB();
  return Array.isArray(data) ? data[0] : data;
}

export async function getWalletTransactions(userId: string) {
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("wallet_transactions")
    .select("id,type,coins,balance_after,description,reference_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data || []).map((tx: any) => ({
    id: tx.id,
    type: tx.type,
    coins: Number(tx.coins || 0),
    balanceAfter: Number(tx.balance_after || 0),
    description: tx.description || "Wallet transaction",
    referenceId: tx.reference_id || null,
    createdAt: tx.created_at,
  }));
}

export async function addContent(
  input: Omit<Content, "id" | "views" | "status">
) {
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("contents")
    .insert({
      creator_id: input.creatorId || null,
      type: input.type,
      title: input.title,
      creator_name: input.creator,
      youtube_url: input.youtubeUrl,
      youtube_video_id: input.youtubeVideoId,
      duration_seconds: input.durationSeconds || 0,
      status: input.type === "live" ? "live" : "active",
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    type: data.type,
    title: data.title,
    creator: data.creator_name,
    creatorId: data.creator_id || undefined,
    youtubeUrl: data.youtube_url,
    youtubeVideoId: data.youtube_video_id,
    durationSeconds: data.duration_seconds || 0,
    views: data.views || 0,
    status: data.status,
    thumbnail: `https://img.youtube.com/vi/${data.youtube_video_id}/hqdefault.jpg`,
  } as Content;
}

export async function createCampaign(input: any) {
  const sb = requireSupabase();
  const requestId = String(input.creationRequestId || crypto.randomUUID());
  const economy = calculateCampaignEconomy(
    Number(input.targetViews),
    Number(input.requiredWatchSeconds)
  );

  const { data, error } = await sb.rpc("create_campaign_with_cost", {
    p_creation_request_id: requestId,
    p_creator_id: input.creatorId,
    p_content_id: input.contentId || null,
    p_title: input.title,
    p_type: input.type,
    p_target_views: economy.targetUsers,
    p_required_watch_seconds: economy.requiredWatchSeconds,
  });

  if (error) throw error;

  await loadDB();

  const campaign = Array.isArray(data) ? data[0] : data;
  if (!campaign) {
    throw new Error("Campaign could not be created.");
  }

  return campaign;
}

export async function qualify(
  campaignId: string,
  userId: string
) {
  const sb = requireSupabase();

  const { error } = await sb.rpc("qualify_campaign_view", {
    p_campaign_id: campaignId,
    p_user_id: userId,
  });

  if (error) throw error;

  await loadDB();
}



export async function adminListUsers(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_users", {
    p_page: options.page || 1,
    p_page_size: options.pageSize || 20,
    p_search: options.search || "",
    p_status: options.status || "",
  });
  if (error) throw error;
  return {
    rows: (data || []).map((u: any) => ({
      id: u.user_id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      emailVerified: Boolean(u.email_verified),
      lastActiveAt: u.last_active_at,
      coinBalance: Number(u.coin_balance || 0),
      totalCount: Number(u.total_users || 0),
    })),
    total: Number(data?.[0]?.total_users || 0),
  };
}

export async function adminGetUserOverview(userId: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_get_user_overview", {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function adminListUserTransactions(options: any) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_user_transactions", {
    p_user_id: options.userId,
    p_page: options.page || 1,
    p_page_size: options.pageSize || 20,
    p_type: options.type || "",
    p_date_from: options.dateFrom || null,
    p_date_to: options.dateTo || null,
    p_search: options.search || "",
  });
  if (error) throw error;
  return {
    rows: data || [],
    total: Number(data?.[0]?.total_count || 0),
  };
}

export async function adminListUserCampaigns(options: any) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_user_campaigns", {
    p_user_id: options.userId,
    p_page: options.page || 1,
    p_page_size: options.pageSize || 20,
    p_status: options.status || "",
    p_date_from: options.dateFrom || null,
    p_date_to: options.dateTo || null,
  });
  if (error) throw error;
  return {
    rows: data || [],
    total: Number(data?.[0]?.total_count || 0),
  };
}

export async function adminListUserWithdrawals(options: any) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_user_withdrawals", {
    p_user_id: options.userId,
    p_page: options.page || 1,
    p_page_size: options.pageSize || 20,
    p_status: options.status || "",
    p_date_from: options.dateFrom || null,
    p_date_to: options.dateTo || null,
  });
  if (error) throw error;
  return {
    rows: data || [],
    total: Number(data?.[0]?.total_count || 0),
  };
}

export async function adminListUserActivity(options: any) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_user_activity", {
    p_user_id: options.userId,
    p_page: options.page || 1,
    p_page_size: options.pageSize || 20,
    p_type: options.type || "",
    p_date_from: options.dateFrom || null,
    p_date_to: options.dateTo || null,
  });
  if (error) throw error;
  return {
    rows: data || [],
    total: Number(data?.[0]?.total_count || 0),
  };
}

export async function adminAdjustUserCoins(userId: string, amount: number, reason: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_adjust_user_coins", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateUserStatus(userId: string, status: string, reason = "") {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_update_user_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateUserName(userId: string, name: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_update_user_name", {
    p_user_id: userId,
    p_name: name,
  });
  if (error) throw error;
  return data;
}

export async function updateSettings(
  patch: Partial<Settings>
) {
  const sb = requireSupabase();

  const { error } = await sb
    .from("app_settings")
    .update({
      reward_per_user: patch.rewardPerUser,
      campaign_creation_cost: patch.campaignCreationCost,
      autoplay_enabled: patch.autoplayEnabled,
      ad_enabled: patch.adEnabled,
      social_bar_enabled: patch.socialBarEnabled,
      high_revenue_banner_enabled: patch.highRevenueBannerEnabled,
      profitabler_square_enabled: patch.profitablerSquareEnabled,
      monetag_vignette_enabled: patch.monetagVignetteEnabled,
      monetag_push_created_enabled: patch.monetagPushCreatedEnabled,
      monetag_in_page_push_enabled: patch.monetagInPagePushEnabled,
      ad_interval_seconds: patch.adIntervalSeconds,
      show_ad_on_end: patch.showAdOnEnd,
      min_short_seconds: patch.minShortSeconds,
      max_short_seconds: patch.maxShortSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw error;

  await loadDB();
}


export async function getWatchedContentIds(userId: string) {
  const sb = requireSupabase();

  const { data, error } = await sb
    .from("content_watch_history")
    .select("content_id")
    .eq("user_id", userId);

  if (error) throw error;

  return (data || []).map((x: any) => x.content_id);
}

export async function markContentWatched(
  userId: string,
  contentId: string
) {
  const sb = requireSupabase();

  const { error } = await sb.rpc(
    "mark_content_watched",
    {
      p_user_id: userId,
      p_content_id: contentId,
    }
  );

  if (error) throw error;
}
