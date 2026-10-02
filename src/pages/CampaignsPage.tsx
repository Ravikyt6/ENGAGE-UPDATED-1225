import React, { useState } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";

function CampaignCard({ campaign, content }: any) {
  const data = useData();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{type:"success"|"error"; message:string} | null>(null);
  const pct = campaign.targetViews
    ? Math.min(100, (campaign.currentViews / campaign.targetViews) * 100)
    : 0;

  const remaining = Math.max(
    0,
    campaign.targetViews - campaign.currentViews
  );

  return (
    <div className="my-campaign">
      <div className="campaign-top">
        <span className={`type-chip ${campaign.type}`}>
          {campaign.type === "shorts"
            ? "SHORTS"
            : campaign.type === "live"
            ? "LIVE"
            : "VIDEO"}
        </span>

        <span className={`status ${campaign.status}`}>
          {String(campaign.status).split("_").join(" ").toUpperCase()}
        </span>
      </div>

      <div className="campaign-main-row">
        {content?.thumbnail ? (
          <img
            className="campaign-thumb"
            src={content.thumbnail}
            alt=""
          />
        ) : (
          <div className="campaign-thumb campaign-thumb-empty">
            ▶
          </div>
        )}

        <div className="campaign-main-info">
          <h3>{campaign.title}</h3>

          <small className="campaign-content-name">
            {content?.title || "YouTube Content"}
          </small>

          <small className="campaign-url">
            {content?.youtubeUrl || ""}
          </small>
        </div>
      </div>

      <div className="campaign-progress-head">
        <span>Campaign Progress</span>
        <b>{pct.toFixed(0)}%</b>
      </div>

      <div className="progress-track">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div className="campaign-stats-grid">
        <div>
          <b>
            {campaign.currentViews.toLocaleString()}
          </b>
          <span>
            / {campaign.targetViews.toLocaleString()} views
          </span>
        </div>

        <div>
          <b>
            {campaign.requiredWatchSeconds}s
          </b>
          <span>watch required</span>
        </div>

        <div>
          <b>₹{Number(campaign.campaignCost || 0).toFixed(2)}</b>
          <span>campaign cost</span>
        </div>

        <div>
          <b>{Number(campaign.totalWatchMinutes || 0).toLocaleString()} min</b>
          <span>total watch time</span>
        </div>
      </div>

      <div className="campaign-bottom-info">
        <span>
          ✓ {campaign.qualifiedUsers || 0} qualified users
        </span>

        <span>
          {remaining.toLocaleString()} views remaining
        </span>

        <span>CAMPAIGN COST</span>
      </div>

      <small className="campaign-created">
        Created{" "}
        {new Date(campaign.createdAt).toLocaleString()}
      </small>

      {campaign.status === "active" || campaign.status === "paused" || campaign.status === "pending" ? (
        <div className="campaign-delete-row">
          <button
            type="button"
            className="campaign-delete-btn"
            disabled={deleting}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
            {deleting ? "DELETING..." : "DELETE CAMPAIGN"}
          </button>

          {confirmDelete && (
            <div className="campaign-confirm-backdrop" role="dialog" aria-modal="true">
              <div className="campaign-confirm-card">
                <button type="button" className="campaign-confirm-close" onClick={() => !deleting && setConfirmDelete(false)} aria-label="Close"><X size={18}/></button>
                <div className="campaign-confirm-icon"><AlertTriangle size={22}/></div>
                <h3>Delete Campaign?</h3>
                <p>The campaign will be marked PARTIAL COMPLETED and its promoted content will be removed from the feed.</p>
                <small>Campaign pricing is calculated from the selected views and watch time.</small>
                <div className="campaign-confirm-actions">
                  <button type="button" className="campaign-confirm-cancel" disabled={deleting} onClick={() => setConfirmDelete(false)}>CANCEL</button>
                  <button type="button" className="campaign-confirm-delete" disabled={deleting} onClick={async () => {
                    setDeleting(true);
                    try {
                      const result = await data.deleteCampaign(campaign.id);
                      setConfirmDelete(false);
                      setToast({type:"success", message:`Campaign marked PARTIAL COMPLETED. Promoted content removed.`});
                      window.setTimeout(() => setToast(null), 4200);
                    } catch (e: any) {
                      setConfirmDelete(false);
                      setToast({type:"error", message:e?.message || "Campaign could not be deleted."});
                      window.setTimeout(() => setToast(null), 4200);
                    } finally {
                      setDeleting(false);
                    }
                  }}>{deleting ? "DELETING..." : "DELETE"}</button>
                </div>
              </div>
            </div>
          )}
          {toast && <div className={`campaign-toast ${toast.type}`} role="status">{toast.type === "success" ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}<span>{toast.message}</span></div>}
        </div>
      ) : null}
    </div>
  );
}

function MyCampaigns({ tab }: { tab: "active" | "closed" }) {
  const { user } = useAuth();
  const data = useData();

  const campaigns = user
    ? data.campaigns.filter((c: any) => c.creatorId === user.id)
    : [];

  const isClosedCampaign = (campaign: any) =>
    campaign.status === "completed" || campaign.status === "partial_completed";

  const visibleCampaigns = campaigns.filter((campaign: any) =>
    tab === "closed" ? isClosedCampaign(campaign) : !isClosedCampaign(campaign)
  );

  const totalViews = visibleCampaigns.reduce(
    (sum: number, c: any) => sum + Number(c.currentViews || 0),
    0
  );

  const targetViews = visibleCampaigns.reduce(
    (sum: number, c: any) => sum + Number(c.targetViews || 0),
    0
  );

  const activeCount = campaigns.filter((c: any) => !isClosedCampaign(c)).length;
  const closedCount = campaigns.filter(isClosedCampaign).length;

  return (
    <>
      <div className="campaign-summary">
        <div>
          <span>ACTIVE CAMPAIGNS</span>
          <b>{activeCount}</b>
        </div>

        <div>
          <span>CLOSED CAMPAIGNS</span>
          <b>{closedCount}</b>
        </div>

        <div>
          <span>VIEWS ACHIEVED</span>
          <b>{totalViews.toLocaleString()}</b>
        </div>

        <div>
          <span>TOTAL TARGET</span>
          <b>{targetViews.toLocaleString()}</b>
        </div>
      </div>

      {visibleCampaigns.length > 0 ? (
        <div className="campaign-list">
          {visibleCampaigns.map((campaign: any) => {
            const content = data.contents.find(
              (x: any) => x.id === campaign.contentId
            );

            return (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                content={content}
              />
            );
          })}
        </div>
      ) : (
        <div className="empty-card campaign-tab-empty">
          <div className="empty-icon">{tab === "closed" ? "✓" : "📢"}</div>
          <h3>
            {tab === "closed" ? "No closed campaigns" : "No active campaigns"}
          </h3>
          <p>
            {tab === "closed"
              ? "Completed and partially completed campaigns will appear here."
              : "Your active campaigns will appear here."}
          </p>
        </div>
      )}
    </>
  );
}

export default function CampaignsPage() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const [tab, setTab] = useState<"active" | "closed">("active");

  return (
    <Layout>
      <div className="content-head">
        <div>
          <h1>Campaigns</h1>
          <p>Create campaigns and track your promotion performance.</p>
        </div>
      </div>

      <div className="campaign-tabs" role="tablist" aria-label="Campaign status">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "active"}
          className={tab === "active" ? "active" : ""}
          onClick={() => setTab("active")}
        >
          ACTIVE CAMPAIGN
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "closed"}
          className={tab === "closed" ? "active" : ""}
          onClick={() => setTab("closed")}
        >
          CLOSED CAMPAIGN
        </button>
      </div>

      <MyCampaigns tab={tab} />
    </Layout>
  );
}


/* ===== CAMPAIGNSPAGE CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.campaign-card,
.my-campaign{
  border: 1px solid #e7e7e7;
  border-radius: 10px;
  padding: 13px;
  background: #fff;
  box-shadow: 0 2px 8px #00000008;
}

.campaign-top{
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: #888;
  text-transform: uppercase;
  font-weight: 800;
}

.campaign-card h3,
.my-campaign h3{
  margin: 10px 0;
  font-size: 16px;
}

.progress-track{
  height: 7px;
  background: #eee;
  border-radius: 8px;
  overflow: hidden;
}

.progress-track i{
  display: block;
  height: 100%;
  background: #e33;
}

.campaign-delete-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px solid #f0f0f0}
.campaign-delete-btn{height:34px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 11px;border:1px solid #ffd2d2;border-radius:8px;background:#fff5f5;color:#e11;font-size:9px;font-weight:950;cursor:pointer}
.campaign-delete-btn:disabled{opacity:.55;cursor:not-allowed}
.campaign-delete-message{font-size:10px;font-weight:800;color:#168447}
.campaign-toast{position:fixed;top:78px;left:50%;transform:translateX(-50%);z-index:2500;max-width:min(92vw,520px);display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:12px;color:#fff;font-size:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.18);animation:campaignToastIn .2s ease-out}
.campaign-toast.success{background:#0a9f4f}.campaign-toast.error{background:#d61f1f}
.campaign-confirm-backdrop{position:fixed;inset:0;z-index:2400;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.52)}
.campaign-confirm-card{position:relative;width:min(100%,380px);padding:24px 20px 18px;border-radius:18px;background:#fff;box-shadow:0 18px 55px rgba(0,0,0,.25);text-align:center}
.campaign-confirm-close{position:absolute;right:10px;top:10px;width:34px;height:34px;border:0;border-radius:9px;background:#f5f5f5;color:#666;display:grid;place-items:center}
.campaign-confirm-icon{width:48px;height:48px;margin:0 auto 11px;border-radius:15px;background:#fff0f0;color:#e11;display:grid;place-items:center}
.campaign-confirm-card h3{margin:0 0 7px;font-size:20px;color:#171717}.campaign-confirm-card p{margin:0;color:#555;font-size:13px;line-height:1.45}.campaign-confirm-card small{display:block;margin-top:5px;color:#999;font-size:11px}
.campaign-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}.campaign-confirm-actions button{height:42px;border-radius:10px;font-size:11px;font-weight:950;cursor:pointer}.campaign-confirm-cancel{border:1px solid #ddd;background:#fff;color:#555}.campaign-confirm-delete{border:1px solid #e11;background:#e11;color:#fff}.campaign-confirm-actions button:disabled{opacity:.55}
@keyframes campaignToastIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.empty-card{
  padding: 30px 15px;
  text-align: center;
  border: 1px solid #eee;
  border-radius: 10px;
  color: #777;
  background: #fff;
}

.campaign-tabs{
  display: flex;
  gap: 6px;
  padding: 4px;
  background: #f3f3f3;
  border-radius: 9px;
  margin: 0 0 13px;
}

.campaign-tabs button{
  flex: 1;
  border: 0;
  background: transparent;
  color: #777;
  border-radius: 7px;
  padding: 10px 8px;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

.campaign-tabs button.active{
  background: #fff;
  color: #e63232;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.08);
}
.campaign-tab-empty{
  min-height: 260px;
}

.campaign-summary{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin-bottom: 10px;
}

.campaign-summary > div{
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 9px;
}

.campaign-summary span{
  display: block;
  color: #999;
  font-size: 8px;
  font-weight: 800;
}

.campaign-summary b{
  display: block;
  color: #222;
  font-size: 16px;
  margin-top: 3px;
}

.my-campaign{
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 9px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.045);
}

.campaign-main-row{
  display: flex;
  gap: 10px;
  margin: 9px 0;
}

.campaign-thumb{
  width: 105px;
  height: 60px;
  object-fit: cover;
  border-radius: 7px;
  flex: none;
}

.campaign-thumb-empty{
  display: grid;
  place-items: center;
  background: #eee;
  color: #888;
  font-weight: 900;
}

.campaign-main-info{
  min-width: 0;
  flex: 1;
}

.campaign-main-info h3{
  margin: 0 0 3px;
  font-size: 13px;
  color: #222;
}

.campaign-content-name,
.campaign-url{
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #888;
  font-size: 9px;
}

.campaign-progress-head{
  display: flex;
  justify-content: space-between;
  margin: 7px 0 5px;
  font-size: 9px;
  color: #777;
  font-weight: 800;
}

.campaign-progress-head b{
  color: #e63232;
}

.campaign-stats-grid{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 9px;
}

.campaign-stats-grid > div{
  background: #f8f8f8;
  border-radius: 6px;
  padding: 7px;
}

.campaign-stats-grid b{
  display: block;
  font-size: 11px;
  color: #222;
}

.campaign-stats-grid span{
  display: block;
  font-size: 8px;
  color: #999;
  margin-top: 2px;
}

.campaign-bottom-info{
  display: flex;
  justify-content: space-between;
  gap: 7px;
  margin-top: 8px;
  font-size: 9px;
  color: #777;
}

.campaign-created{
  display: block;
  color: #aaa;
  font-size: 8px;
  margin-top: 8px;
}

.empty-icon{
  font-size: 28px;
}

.empty-card h3{
  margin: 8px 0 3px;
  font-size: 15px;
}

.empty-card p{
  margin: 0 0 14px;
  color: #888;
  font-size: 11px;
}

.create-back{
  color: #e63232;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  margin: 3px 0 11px;
}

@media (max-width: 600px){.campaign-summary{
    grid-template-columns: repeat(2, 1fr);
  }
.campaign-stats-grid{
    grid-template-columns: repeat(2, 1fr);
  }
.campaign-bottom-info{
    flex-wrap: wrap;
  }
.campaign-thumb{
    width: 90px;
    height: 52px;
  }}

@media(max-width:700px){
  .campaign-summary{grid-template-columns:repeat(2,1fr)}
  .campaign-tabs{gap:5px;margin-bottom:12px}
  .campaign-tabs button{min-height:44px;padding:10px 6px;font-size:9px;white-space:nowrap}
  .campaign-tab-empty{min-height:240px}
}

/* Creator campaign mobile readability polish */
@media(max-width:600px){
  .campaign-top{font-size:11px}
  .campaign-card,.my-campaign{padding:16px;border-radius:14px}
  .campaign-card h3,.my-campaign h3{font-size:18px;margin:11px 0 7px}
  .campaign-content-name,.campaign-url{font-size:11px !important;line-height:1.35}
  .campaign-progress-head{font-size:11px}
  .campaign-stats-grid{gap:9px}
  .campaign-stats-grid>div{padding:12px 10px}
  .campaign-stats-grid b{font-size:18px}
  .campaign-stats-grid span,.campaign-bottom-info,.campaign-created{font-size:11px}
  .campaign-bottom-info{gap:8px;line-height:1.4}
  .campaign-delete-btn{height:40px;padding:0 14px;font-size:11px;border-radius:10px}
  .campaign-toast{top:70px;font-size:12px;padding:12px 14px}
}

`;


