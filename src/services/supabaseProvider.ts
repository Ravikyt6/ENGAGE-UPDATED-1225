import type { DB, User, Content, Campaign, Settings, SitePage, SitePageSlug , MilestoneConfig } from "@/types";
import { supabase } from "./supabase";
import { seedDB, defaultSettings } from "@/data/seed";


let remoteCache: DB = {
  users: [],
  contents: [],
  campaigns: [],
  wallets: {},
  settings: defaultSettings,
  milestones: [],
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

  const [profiles, wallets, contents, campaigns, settings, milestones] =
    await Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: false }),
      sb.from("wallets").select("*"),
      sb.from("contents").select("*").order("created_at", { ascending: false }),
      sb.from("campaigns").select("*").order("created_at", { ascending: false }),
      sb.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      sb.from("milestone_configs").select("*").eq("active", true).order("views", { ascending: true }),
    ]);

  const error =
    profiles.error ||
    wallets.error ||
    contents.error ||
    campaigns.error ||
    settings.error ||
    milestones.error;

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
      campaignCost: Number(c.campaign_cost || 0),
      totalWatchMinutes: Number(c.total_watch_minutes || 0),
      creatorId: c.creator_id,
      title: c.title,
      type: c.type,
      contentId: c.content_id || "",
      targetViews: c.target_views,
      requiredWatchSeconds: c.required_watch_seconds,
      currentViews: c.current_views || 0,
      qualifiedUsers: c.qualified_users || 0,
      status: c.status,
      createdAt: c.created_at,
      creationRequestId: c.creation_request_id || undefined,
    })),
    wallets: Object.fromEntries(
      (wallets.data || []).map((w: any) => [w.user_id, { coins: Number(w.coins || 0), earnings: Number(w.earnings || 0) }])
    ),
    settings: {
      ...defaultSettings,
      ...(settings.data || {}),
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
      campaignPricePerView: Number(
        settings.data?.campaign_price_per_view ?? defaultSettings.campaignPricePerView
      ),
      campaignPricePerSecond: Number(
        settings.data?.campaign_price_per_second ?? defaultSettings.campaignPricePerSecond
      ),
      campaignViewOptions: Array.isArray(settings.data?.campaign_view_options) && settings.data.campaign_view_options.length
        ? settings.data.campaign_view_options.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
        : defaultSettings.campaignViewOptions,
      campaignWatchSecondOptions: Array.isArray(settings.data?.campaign_watch_second_options) && settings.data.campaign_watch_second_options.length
        ? settings.data.campaign_watch_second_options.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
        : defaultSettings.campaignWatchSecondOptions,
    },
    milestones: (milestones.data || []).map((m: any) => ({ id: m.id, views: Number(m.views), rewardRupees: Number(m.reward_rupees), sortOrder: Number(m.sort_order || 0), active: m.active !== false })),
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
  const { data, error } = await sb.rpc("create_campaign_with_pricing", {
    p_creation_request_id: requestId,
    p_creator_id: input.creatorId,
    p_content_id: input.contentId || null,
    p_title: input.title,
    p_type: input.type,
    p_target_views: Math.floor(Number(input.targetViews || 0)),
    p_watch_seconds: Math.floor(Number(input.watchSeconds || 0)),
  });
  if (error) throw error;
  await loadDB();
  const campaign = Array.isArray(data) ? data[0] : data;
  if (!campaign) throw new Error("Campaign could not be created.");
  return campaign;
}

export async function deleteCampaign(campaignId: string, creatorId: string) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("delete_campaign_and_refund", {
    p_campaign_id: campaignId,
    p_creator_id: creatorId,
  });
  if (error) throw error;
  await loadDB();
  const row = Array.isArray(data) ? data[0] : data;
  return {
    campaign: row,
    refundedCoins: Number(row?.refunded_coins || 0),
  };
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


export async function adminListWithdrawals(options: any = {}) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_list_withdrawals", {
    p_page: options.page || 1,
    p_page_size: options.pageSize || 25,
    p_status: options.status || "",
    p_search: options.search || "",
    p_date_from: options.dateFrom || null,
    p_date_to: options.dateTo || null,
  });
  if (error) throw error;
  return { rows: data || [], total: Number(data?.[0]?.total_count || 0) };
}

export async function adminWithdrawalSummary() {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_withdrawal_summary");
  if (error) throw error;
  return data?.[0] || { total_count: 0, pending_count: 0, processing_count: 0, completed_count: 0, rejected_count: 0, failed_count: 0, pending_coins: 0, completed_coins: 0, completed_amount: 0 };
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, referenceId = "") {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_update_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_status: status,
    p_reference_id: referenceId || null,
  });
  if (error) throw error;
  return data;
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
      campaign_price_per_view: patch.campaignPricePerView,
      campaign_price_per_second: patch.campaignPricePerSecond,
      campaign_view_options: patch.campaignViewOptions,
      campaign_watch_second_options: patch.campaignWatchSecondOptions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw error;

  await loadDB();
}


export async function updateMilestones(milestones: MilestoneConfig[]) {
  const sb = requireSupabase();
  const { error: deleteError } = await sb.from("milestone_configs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw deleteError;
  if (milestones.length) {
    const { error } = await sb.from("milestone_configs").insert(milestones.map((m, i) => ({ id: m.id, views: Math.max(1, Math.floor(Number(m.views))), reward_rupees: Math.max(0, Number(m.rewardRupees)), sort_order: i, active: m.active !== false })));
    if (error) throw error;
  }
  await loadDB();
  return remoteCache.milestones;
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


export async function getSitePage(slug: SitePageSlug): Promise<SitePage> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("site_pages")
    .select("slug,title,content,updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { slug, title: slug === "about" ? "About ENGAGE" : slug === "privacy" ? "Privacy Policy" : slug === "terms" ? "Terms & Conditions" : slug === "contact" ? "Contact Us" : "Help & Support", content: "" };
  }

  return {
    slug: data.slug as SitePageSlug,
    title: data.title,
    content: data.content || "",
    updatedAt: data.updated_at || undefined,
  };
}

export async function updateSitePages(pages: SitePage[]) {
  const sb = requireSupabase();
  const rows = pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    content: page.content,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await sb.from("site_pages").upsert(rows, { onConflict: "slug" });
  if (error) throw error;
}
