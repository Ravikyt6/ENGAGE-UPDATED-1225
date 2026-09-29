import React, { useMemo, useState } from "react";
import { dataProvider } from "@/services/dataProvider";
import type { CampaignStatus, ContentType } from "@/types";
import { Filter, Search } from "lucide-react";

const TYPE_LABELS: Record<ContentType, string> = {
  video: "VIDEO",
  shorts: "SHORTS",
  live: "LIVE",
};

const STATUS_LABELS: Record<string, string> = {
  active: "ACTIVE",
  paused: "PAUSED",
  pending: "PENDING",
  draft: "DRAFT",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  rejected: "REJECTED",
};

export default function AdminCampaigns() {
  const db = dataProvider.getDB();
  const [type, setType] = useState<ContentType | "all">("all");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.campaigns
      .filter((campaign) => type === "all" || campaign.type === type)
      .filter((campaign) => status === "all" || campaign.status === status)
      .filter((campaign) => {
        if (!q) return true;
        const content = db.contents.find((item) => item.id === campaign.contentId);
        const creator = db.users.find((user) => user.id === campaign.creatorId);
        return [
          campaign.title,
          content?.title,
          creator?.name,
          creator?.email,
          campaign.type,
          campaign.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [db, type, status, search]);

  const stats = useMemo(() => ({
    total: db.campaigns.length,
    active: db.campaigns.filter((c) => c.status === "active").length,
    video: db.campaigns.filter((c) => c.type === "video").length,
    shorts: db.campaigns.filter((c) => c.type === "shorts").length,
    live: db.campaigns.filter((c) => c.type === "live").length,
  }), [db]);

  return (
    <div className="campaign-admin-page">
      <div className="admin-head campaign-admin-head">
        <div>
          <h1>Campaigns</h1>
          <p>All campaigns and their linked content in one place.</p>
        </div>
      </div>

      <div className="campaign-admin-stats">
        <button className={status === "all" && type === "all" ? "selected" : ""} onClick={() => { setStatus("all"); setType("all"); }}>
          <b>{stats.total}</b><span>All Campaigns</span>
        </button>
        <button className={status === "active" ? "selected" : ""} onClick={() => { setStatus("active"); setType("all"); }}>
          <b>{stats.active}</b><span>Active</span>
        </button>
        <button className={type === "video" ? "selected" : ""} onClick={() => { setType("video"); setStatus("all"); }}>
          <b>{stats.video}</b><span>Video</span>
        </button>
        <button className={type === "shorts" ? "selected" : ""} onClick={() => { setType("shorts"); setStatus("all"); }}>
          <b>{stats.shorts}</b><span>Shorts</span>
        </button>
        <button className={type === "live" ? "selected" : ""} onClick={() => { setType("live"); setStatus("all"); }}>
          <b>{stats.live}</b><span>Live</span>
        </button>
      </div>

      <div className="campaign-admin-filters">
        <div className="campaign-search">
          <Search size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaign, creator or content..." />
        </div>
        <div className="campaign-filter-select">
          <Filter size={16} />
          <select value={type} onChange={(e) => setType(e.target.value as ContentType | "all")}>
            <option value="all">All Types</option>
            <option value="video">Video</option>
            <option value="shorts">Shorts</option>
            <option value="live">Live</option>
          </select>
        </div>
        <div className="campaign-filter-select">
          <select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus | "all")}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="campaign-admin-list">
        {rows.map((campaign) => {
          const content = db.contents.find((item) => item.id === campaign.contentId);
          const creator = db.users.find((user) => user.id === campaign.creatorId);
          const progress = campaign.targetViews > 0 ? Math.min(100, (campaign.currentViews / campaign.targetViews) * 100) : 0;
          return (
            <div className="campaign-admin-card" key={campaign.id}>
              <div className="campaign-admin-main">
                <div className="campaign-admin-title-row">
                  <h2>{campaign.title}</h2>
                  <span className={`campaign-status campaign-status-${campaign.status}`}>{STATUS_LABELS[campaign.status] || campaign.status.toUpperCase()}</span>
                </div>
                <div className="campaign-admin-meta">
                  <span className={`campaign-type campaign-type-${campaign.type}`}>{TYPE_LABELS[campaign.type]}</span>
                  <span>Created by <b>{creator?.name || "Unknown creator"}</b></span>
                  {creator?.email && <span>{creator.email}</span>}
                </div>
                <div className="campaign-content-line">
                  <span className="campaign-content-label">CONTENT</span>
                  <b>{content?.title || "Linked content unavailable"}</b>
                  {content && <span>• {Math.round(content.durationSeconds || 0)}s • {content.status}</span>}
                </div>
              </div>
              <div className="campaign-admin-progress">
                <div className="campaign-progress-head"><span>Views</span><b>{campaign.currentViews}/{campaign.targetViews}</b></div>
                <div className="campaign-progress-track"><div style={{ width: `${progress}%` }} /></div>
                <div className="campaign-watch">Watch requirement: <b>{campaign.requiredWatchSeconds}s</b></div>
              </div>
            </div>
          );
        })}
        {!rows.length && <div className="admin-panel">No campaigns match the selected filters.</div>}
      </div>

      <style>{CAMPAIGN_CSS}</style>
    </div>
  );
}

const CAMPAIGN_CSS = String.raw`
.campaign-admin-page{width:100%;}
.campaign-admin-head{margin-bottom:18px;}
.campaign-admin-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px;}
.campaign-admin-stats button{border:1px solid #e3e3e3;background:#fff;border-radius:12px;padding:14px 15px;text-align:left;cursor:pointer;transition:.15s;}
.campaign-admin-stats button:hover,.campaign-admin-stats button.selected{border-color:#ff1616;box-shadow:0 0 0 1px #ff1616 inset;}
.campaign-admin-stats b{display:block;font-size:22px;color:#161616;}
.campaign-admin-stats span{display:block;color:#777;font-size:12px;margin-top:3px;}
.campaign-admin-filters{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap;}
.campaign-search,.campaign-filter-select{height:42px;background:#fff;border:1px solid #ddd;border-radius:10px;display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;}
.campaign-search{flex:1;min-width:240px;color:#888;}
.campaign-search input{border:0;outline:0;width:100%;font-size:14px;background:transparent;}
.campaign-filter-select{min-width:145px;}
.campaign-filter-select select{border:0;outline:0;background:#fff;font-size:13px;width:100%;cursor:pointer;}
.campaign-admin-list{display:flex;flex-direction:column;gap:10px;}
.campaign-admin-card{background:#fff;border:1px solid #e2e2e2;border-radius:13px;padding:16px 18px;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:22px;}
.campaign-admin-title-row{display:flex;gap:12px;align-items:center;justify-content:space-between;}
.campaign-admin-title-row h2{margin:0;font-size:18px;color:#171717;line-height:1.25;}
.campaign-status{font-size:11px;font-weight:800;border-radius:20px;padding:6px 10px;white-space:nowrap;}
.campaign-status-active{background:#e8f8ec;color:#16833b;}.campaign-status-paused{background:#fff3d7;color:#9b6500;}.campaign-status-pending{background:#eef2ff;color:#4857a6;}.campaign-status-completed{background:#e9f4ff;color:#1269a8;}.campaign-status-cancelled,.campaign-status-rejected{background:#ffe9e9;color:#c40000;}.campaign-status-draft{background:#f1f1f1;color:#666;}
.campaign-admin-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#777;font-size:12px;margin-top:8px;}
.campaign-type{font-weight:800;font-size:10px;padding:5px 8px;border-radius:5px;background:#f2f2f2;color:#333;}
.campaign-type-shorts{background:#fff0f0;color:#d40000;}.campaign-type-live{background:#f0f4ff;color:#3158b7;}
.campaign-content-line{margin-top:14px;background:#f8f8f8;border-radius:8px;padding:10px 11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:#777;}
.campaign-content-label{font-size:9px;font-weight:800;color:#999;letter-spacing:.5px;}.campaign-content-line b{color:#222;}
.campaign-admin-progress{align-self:center;min-width:0;}.campaign-progress-head{display:flex;justify-content:space-between;font-size:12px;color:#777;margin-bottom:7px;}.campaign-progress-head b{color:#222;}.campaign-progress-track{height:7px;border-radius:10px;background:#eee;overflow:hidden;}.campaign-progress-track div{height:100%;background:#ff1616;border-radius:10px;}.campaign-watch{font-size:11px;color:#888;margin-top:8px;}
@media(max-width:900px){.campaign-admin-stats{grid-template-columns:repeat(2,minmax(0,1fr));}.campaign-admin-card{grid-template-columns:1fr;}.campaign-admin-progress{padding-top:2px;}}
@media(max-width:560px){.campaign-admin-stats{grid-template-columns:1fr 1fr;}.campaign-search{min-width:100%;}.campaign-filter-select{flex:1;}.campaign-admin-card{padding:13px;}.campaign-admin-title-row{align-items:flex-start;flex-direction:column;gap:7px;}}
`;
