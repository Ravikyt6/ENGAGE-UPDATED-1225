import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { CheckCircle2, IndianRupee, Link2, Loader2, PlaySquare, Radio, Video } from "lucide-react";
import React, { useMemo, useState } from "react";
import YouTubePlayer from "@/components/YouTubePlayer";

type CampaignType = "video" | "shorts" | "live";

function getYouTubeId(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
      if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] || null;
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || null;
    }
  } catch {}
  const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([^?&#/]+)/);
  return match?.[1] || null;
}

function formatWatchTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (!mins) return `${secs}s`;
  if (!secs) return `${mins} min`;
  return `${mins}m ${secs}s`;
}

export default function CreateCampaignPage() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const { user } = useAuth();
  const data = useData();
  const settings = data.db?.settings || {};
  const pricePerView = Math.max(0, Number(settings.campaignPricePerView ?? 0));
  const pricePerSecond = Math.max(0, Number(settings.campaignPricePerSecond ?? 0));
  const viewOptions = (settings.campaignViewOptions || [10, 25, 50, 100, 250, 500, 1000]).map(Number).filter((v: number) => Number.isFinite(v) && v > 0);
  const watchOptions = (settings.campaignWatchSecondOptions || [15, 30, 45, 60]).map(Number).filter((v: number) => Number.isFinite(v) && v > 0);
  const [type, setType] = useState<CampaignType>("video");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [targetViews, setTargetViews] = useState(0);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [creationRequestId, setCreationRequestId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const availableWatchOptions = watchOptions.filter((seconds: number) => type !== "shorts" || seconds < 60);

  const videoId = useMemo(() => getYouTubeId(url), [url]);
  const totalWatchSeconds = targetViews * watchSeconds;
  const campaignCost = targetViews * pricePerView + totalWatchSeconds * pricePerSecond;

  const changeType = (next: CampaignType) => {
    setType(next);
    if (next === "shorts" && watchSeconds >= 60) setWatchSeconds(0);
    setLoaded(false);
    setError("");
    setVideoDuration(0);
  };

  const loadYouTube = () => {
    setError("");
    setLoaded(false);
    setFetchingContent(false);
    setVideoDuration(0);
    if (!videoId) {
      setError("Please enter a valid YouTube Video, Shorts or Live URL.");
      return;
    }
    setFetchingContent(true);
  };

  const createCampaign = async () => {
    setError("");
    setSuccess("");
    if (!user) return setError("Please login first.");
    if (!videoId) return setError("Please enter and load a valid YouTube URL.");
    if (!loaded) return setError("Please load the YouTube content first.");
    if (!title.trim()) return setError("Please enter campaign title.");
    if (targetViews < 1) return setError("Select the number of views.");
    if (watchSeconds < 1) return setError("Select the required watch time.");
    if (viewOptions.length && !viewOptions.includes(targetViews)) return setError("Please select a valid number of views.");
    if (availableWatchOptions.length && !availableWatchOptions.includes(watchSeconds)) return setError("Please select a valid watch time.");
    if (type === "shorts" && watchSeconds >= 60) return setError("Shorts campaigns need less than 60 seconds per view.");
    if (type === "shorts" && videoDuration >= 60) return setError("This content is 60 seconds or longer and is not eligible as a Short.");
    if (campaignCost <= 0) return setError("Campaign pricing is not configured by admin yet.");

    try {
      setLoading(true);
      await data.createCampaign({
        createdBy: user.id || user.email,
        type,
        title: title.trim(),
        youtubeUrl: url.trim(),
        youtubeVideoId: videoId,
        durationSeconds: videoDuration,
        targetViews,
        watchSeconds,
        campaignCost,
        creationRequestId,
      });
      setTitle("");
      setUrl("");
      setLoaded(false);
      setFetchingContent(false);
      setVideoDuration(0);
      setCreationRequestId(crypto.randomUUID());
      setTargetViews(0);
      setWatchSeconds(0);
      setSuccess(`Campaign created. ${targetViews.toLocaleString()} views × ${formatWatchTime(watchSeconds)} per user. Cost: ₹${campaignCost.toFixed(2)}.`);
      window.setTimeout(() => setSuccess(""), 4200);
    } catch (e: any) {
      setError(e?.message || "Could not create campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="form-page create-campaign-page">
        <div className="create-page-heading">
          <div className="heading-icon"><IndianRupee size={20} /></div>
          <div>
            <h1>Create Campaign</h1>
            <p>Set views and watch time. Campaign cost is calculated automatically from Admin pricing.</p>
          </div>
        </div>

        <div className="campaign-create-card">
          <div className="type-tabs">
            <button type="button" className={type === "video" ? "selected" : ""} onClick={() => changeType("video")}><Video size={18} /> VIDEO</button>
            <button type="button" className={type === "shorts" ? "selected" : ""} onClick={() => changeType("shorts")}><PlaySquare size={18} /> SHORTS</button>
            <button type="button" className={type === "live" ? "selected" : ""} onClick={() => changeType("live")}><Radio size={18} /> LIVE</button>
          </div>

          <div className="create-type-note">
            <div className="create-type-icon">{type === "video" ? <Video size={17} /> : type === "shorts" ? <PlaySquare size={17} /> : <Radio size={17} />}</div>
            <div>
              <b>{type === "video" ? "Video Campaign" : type === "shorts" ? "Shorts Campaign" : "Live Campaign"}</b>
              <span>{type === "shorts" ? "Only content under 60 seconds is accepted." : "Choose how many qualified views and how much watch time each user must complete."}</span>
            </div>
          </div>

          <label><Link2 size={14} /> YouTube Content URL</label>
          <div className="create-url-row">
            <div className="create-url-input">
              <Link2 size={16} />
              <input value={url} onChange={(e) => { setUrl(e.target.value); setLoaded(false); setFetchingContent(false); setVideoDuration(0); setError(""); }} placeholder={type === "live" ? "https://youtube.com/live/..." : type === "shorts" ? "https://youtube.com/shorts/..." : "https://youtube.com/watch?v=..."} />
            </div>
            <button type="button" className="create-load-btn" onClick={loadYouTube}>LOAD</button>
          </div>

          {fetchingContent && videoId && (
            <div className="campaign-fetching-card" role="status">
              <Loader2 size={18} className="create-spin" />
              <div><b>FETCHING CONTENT DATA...</b><span>Checking YouTube content and eligibility. Please wait.</span></div>
            </div>
          )}

          {videoId && (fetchingContent || loaded) && (
            <div className="campaign-duration-validator" aria-hidden="true">
              <YouTubePlayer
                key={`${videoId}-${type}`}
                videoId={videoId}
                autoplay={false}
                onReady={() => { if (type !== "shorts") { setLoaded(true); setFetchingContent(false); } }}
                onTime={(_, duration) => {
                  if (duration > 0) {
                    setVideoDuration(duration);
                    setLoaded(true);
                    setFetchingContent(false);
                  }
                }}
                onError={() => {
                  setLoaded(false);
                  setFetchingContent(false);
                  setVideoDuration(0);
                  setError("Could not fetch this YouTube content. Please check the link and try again.");
                }}
              />
            </div>
          )}

          {loaded && videoId && (
            <div className="youtube-preview create-preview">
              <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" />
              <div>
                <div className="loaded-status"><CheckCircle2 size={13} /> {type === "shorts" && videoDuration >= 60 ? "NOT ELIGIBLE" : "CONTENT LOADED"}</div>
                <b>{type.toUpperCase()} CONTENT</b>
                <small>{videoId}{videoDuration > 0 ? ` • ${Math.ceil(videoDuration)}s` : ""}</small>
              </div>
            </div>
          )}

          {loaded && type === "shorts" && videoDuration >= 60 && (
            <div className="error-inline campaign-load-error">This content is 60 seconds or longer and is not eligible as a Short.</div>
          )}

          <label>Campaign Title</label>
          <input className="form-input create-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter campaign title" />

          <div className="campaign-pricing-card">
            <div className="creator-pricing-row">
              <span>Number of Views</span>
              <div className="creator-red-select">
                <select value={targetViews || ""} onChange={e => setTargetViews(Number(e.target.value || 0))}>
                  <option value="" disabled>Select views</option>
                  {viewOptions.map((views: number) => <option key={views} value={views}>{views.toLocaleString()}</option>)}
                </select>
                <span>⌄</span>
              </div>
            </div>

            <div className="creator-pricing-row">
              <span>Time required (seconds)</span>
              <div className="creator-red-select">
                <select value={watchSeconds || ""} onChange={e => setWatchSeconds(Number(e.target.value || 0))}>
                  <option value="" disabled>Select time</option>
                  {availableWatchOptions.map((seconds: number) => <option key={seconds} value={seconds}>{seconds}</option>)}
                </select>
                <span>⌄</span>
              </div>
            </div>

            <div className="creator-pricing-row creator-total-row">
              <span>Total Coin</span>
              <div className="creator-total-value">{campaignCost.toFixed(0)}</div>
            </div>
          </div>

          {success && <div className="engage-toast success-toast"><CheckCircle2 size={18}/><div><b>Successfully Created</b><span>{success}</span></div></div>}
          {error && <div className="error create-error">{error}</div>}

          <button type="button" className="primary-btn create-btn" disabled={loading || !loaded || targetViews < 1 || watchSeconds < 1 || (type === "shorts" && watchSeconds >= 60) || campaignCost <= 0} onClick={createCampaign}>
            {loading ? <><Loader2 size={17} className="create-spin" /> CREATING...</> : <>CREATE CAMPAIGN <span>• ₹{campaignCost.toFixed(2)}</span></>}
          </button>
          <div className="create-safe-note">Campaign cost is fixed from the Admin pricing settings. Creator cannot change the rates.</div>
        </div>
      </div>
    </Layout>
  );
}

/* ===== CREATECAMPAIGNPAGE CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.form-page{
  max-width: 620px;
  margin: auto;
}

.form-page label,
.settings-grid label{
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: #555;
  margin: 10px 0 5px;
}

.form-input,
.settings-grid input,
.settings-grid select{
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 7px;
  outline: none;
  background: #fff;
}

.form-input:focus{
  border-color: #FF0000;
  box-shadow: 0 0 0 3px rgba(237, 52, 52, 0.08);
}

.two-col{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.campaign-pricing-card{margin-top:14px;padding:4px 0;border:0;border-radius:0;background:#fff}.creator-pricing-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 0 20px;min-height:72px}.creator-pricing-row>span{font-size:22px;line-height:1.15;font-weight:500;color:#666}.creator-red-select,.creator-total-value{position:relative;flex:0 0 274px;height:58px;border-radius:11px;background:#ef3535;box-shadow:0 5px 10px rgba(0,0,0,.14);overflow:hidden}.creator-red-select select{appearance:none;-webkit-appearance:none;width:100%;height:100%;padding:0 58px 0 28px;border:0;outline:none;background:transparent;color:#fff;font-size:25px;font-weight:400;cursor:pointer}.creator-red-select select option{background:#fff;color:#222;font-size:15px}.creator-red-select>span{position:absolute;right:25px;top:50%;transform:translateY(-58%);color:#fff;font-size:34px;line-height:1;pointer-events:none;font-weight:300}.creator-total-row{margin-bottom:0}.creator-total-row>span{color:#e73535}.creator-total-value{display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:400}.creator-total-value::after{content:""}@media(max-width:700px){.creator-pricing-row{gap:10px;min-height:58px;margin-bottom:14px}.creator-pricing-row>span{font-size:17px}.creator-red-select,.creator-total-value{flex-basis:180px;height:52px}.creator-red-select select{font-size:21px;padding-left:18px;padding-right:44px}.creator-red-select>span{right:16px;font-size:29px}.creator-total-value{font-size:22px}}@media(max-width:460px){.creator-pricing-row>span{font-size:15px}.creator-red-select,.creator-total-value{flex-basis:150px}.creator-red-select select{font-size:19px}}

.youtube-preview{
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px;
  background: #fafafa;
  border-radius: 9px;
  margin: 9px 0 11px;
  border: 1px solid #e8e8e8;
}

.youtube-preview img{
  width: 108px;
  border-radius: 6px;
  height: 61px;
  object-fit: cover;
  flex: none;
}

.youtube-preview small{
  display: block;
  color: #777;
  font-size: 9px;
  margin-top: 3px;
}

.form-page > h1{
  margin: 0 0 6px;
  font-size: 27px;
  line-height: 1.15;
  font-weight: 950;
  color: #222;
  letter-spacing: -0.5px;
}

.form-page > p{
  margin: 0 0 15px;
  color: #777;
  font-size: 12px;
}

.type-tabs button:hover{
  border-color: #FF0000;
}

.form-page label{
  display: block;
  margin: 12px 0 6px !important;
  color: #444;
  font-size: 11px;
  font-weight: 900;
}

.form-input{
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #d9d9d9;
  border-radius: 9px;
  outline: none;
  background: #fff;
  color: #222;
  font-size: 12px;
  transition: 0.15s;
}

.form-page .form-input[placeholder*="youtube"],
.form-page .form-input[placeholder*="YouTube"]{
  min-width: 0;
}

.form-page label + .form-input{
  display: block;
}

.form-page .two-col{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.heading-icon{
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: #fff0f0;
  color: #FF0000;
  display: grid;
  place-items: center;
  flex: none;
}

.create-campaign-page .campaign-create-card{
  padding: 14px;
  border: 1px solid #e6e6e6;
  border-radius: 16px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.06);
}

.create-campaign-page .type-tabs button{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 56px;
}

.create-type-icon{
  width: 35px;
  height: 35px;
  border-radius: 9px;
  background: #FF0000;
  color: #fff;
  display: grid;
  place-items: center;
  flex: none;
}

.create-type-note b,

.create-campaign-page label{
  display: flex;
  align-items: center;
  gap: 5px;
}

.create-load-btn:hover{
  background: #FF0000;
  color: #fff;
  border-color: #FF0000;
}

.create-preview img{
  width: 105px !important;
  height: 60px;
  object-fit: cover;
}

.loaded-status{
  display: flex;
  align-items: center;
  gap: 4px;
  color: #079447;
  font-size: 8px;
  font-weight: 950;
}

.create-preview b{
  display: block;
  font-size: 11px;
  margin-top: 4px;
}

.create-preview small{
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: #999;
}

.campaign-duration-validator{position:absolute;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;top:-9999px}
.campaign-fetching-card{display:flex;align-items:center;gap:11px;margin:10px 0;padding:14px;border:1px solid #ffd7d7;border-radius:12px;background:#fff8f8;color:#f00}
.campaign-fetching-card b{display:block;font-size:11px;font-weight:950}.campaign-fetching-card span{display:block;margin-top:3px;color:#777;font-size:10px}


.create-cost-icon{
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #FF0000;
  color: #fff;
  display: grid;
  place-items: center;
}

.create-spin{
  animation: createSpin 0.8s linear infinite;
}

.engage-toast{
  top: 82px;
}

.success-toast{
  background: #0c9a49;
  color: #fff;
  border: 1px solid #07833d;
}

@media (max-width: 600px){.two-col,
    .campaign-admin-info{
    grid-template-columns: 1fr;
  }}

@media (max-width: 600px){.form-page{
    max-width: 100%;
  }
.form-page > h1{
    font-size: 25px;
  }}

@media (max-width: 600px){.create-campaign-page .campaign-create-card{
    padding: 12px;
  }}

@media (min-width: 901px){.form-page,
    .create-page,
    .content-page{
    width: min(100%, 920px);
    margin-left: auto;
    margin-right: auto;
  }}

@media (min-width: 601px) and (max-width: 1100px){.form-page,
    .create-page{
    max-width: 760px;
    margin-left: auto;
    margin-right: auto;
  }}

@media (min-width: 901px){.campaign-create-card .two-col{
    grid-template-columns: 1fr 1fr;
  }}

.create-campaign-page{
  width:min(100%,760px);
  max-width:760px;
  margin:0 auto;
  padding:4px 0 34px;
}

.create-page-heading{
  display:flex;
  align-items:center;
  gap:12px;
  margin:0 0 18px;
}

.create-page-heading .heading-icon{
  width:46px;
  height:46px;
  flex:none;
  border-radius:13px;
  display:grid;
  place-items:center;
  background:#fff0f0;
  color:#FF0000;
}

.create-page-heading h1{
  margin:0;
  color:#1f2328;
  font-size:30px;
  line-height:1.08;
  font-weight:900;
  letter-spacing:-.7px;
}

.create-page-heading p{
  margin:5px 0 0;
  color:#7b7f85;
  font-size:12px;
}

.campaign-create-card{
  width:100%;
  box-sizing:border-box;
  padding:18px;
  border:1px solid #e7e7e7;
  border-radius:18px;
  background:#fff;
  box-shadow:0 10px 30px rgba(0,0,0,.07);
}

.type-tabs{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
  margin-bottom:16px;
}

.type-tabs button{
  min-height:58px;
  padding:0 10px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  border:1px solid #dedede;
  border-radius:11px;
  background:#f8f8f8;
  color:#555;
  font-size:13px;
  font-weight:900;
  cursor:pointer;
  transition:.16s ease;
}

.type-tabs button:hover{
  border-color:#FF0000;
}

.type-tabs button.selected,
.type-tabs .selected{
  background:#FF0000;
  border-color:#FF0000;
  color:#fff;
  box-shadow:0 7px 16px rgba(237,52,52,.18);
}

.create-type-note{
  display:flex;
  align-items:center;
  gap:11px;
  margin-bottom:17px;
  padding:11px 12px;
  border:1px solid #ffd5d5;
  border-radius:11px;
  background:#fff7f7;
}

.create-type-note .create-type-icon{
  width:38px;
  height:38px;
  flex:none;
  display:grid;
  place-items:center;
  border-radius:10px;
  background:#FF0000;
  color:#fff;
}

.create-type-note b,
.create-type-note span{
  display:block;
}

.create-type-note b{
  color:#222;
  font-size:12px;
}

.create-type-note span{
  margin-top:3px;
  color:#858585;
  font-size:10px;
}

.create-campaign-page label{
  display:flex;
  align-items:center;
  gap:5px;
  margin:12px 0 6px;
  color:#414141;
  font-size:11px;
  font-weight:900;
}

.create-url-row{
  display:flex;
  gap:8px;
  align-items:stretch;
}

.create-url-input{
  flex:1;
  min-width:0;
  height:46px;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  gap:8px;
  padding:0 12px;
  border:1px solid #d8d8d8;
  border-radius:10px;
  background:#fff;
}

.create-url-input:focus-within{
  border-color:#FF0000;
  box-shadow:0 0 0 3px rgba(237,52,52,.08);
}

.create-url-input svg{
  flex:none;
  color:#9b9b9b;
}

.create-url-input input{
  width:100%;
  height:100%;
  min-width:0;
  margin:0;
  padding:0;
  border:0;
  outline:0;
  background:transparent;
  color:#222;
  font-size:12px;
  box-shadow:none;
}

.create-url-input input:focus{
  border:0;
  box-shadow:none;
}

.create-load-btn{
  width:88px;
  flex:none;
  border:1px solid #dedede;
  border-radius:10px;
  background:#f5f5f5;
  color:#555;
  font-size:11px;
  font-weight:900;
  cursor:pointer;
}

.create-load-btn:hover{
  border-color:#FF0000;
  color:#FF0000;
}

.create-preview{
  margin-top:10px;
}

.create-input{
  width:100%;
  height:46px !important;
  box-sizing:border-box;
  margin:0;
  padding:0 12px !important;
  background:#fff !important;
  color:#222 !important;
  border:1px solid #d8d8d8 !important;
  border-radius:10px !important;
}

.create-input:focus{
  border-color:#FF0000 !important;
  box-shadow:0 0 0 3px rgba(237,52,52,.08) !important;
}

.create-criteria{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  margin-top:2px;
}

.create-number-field{
  height:46px;
  display:flex;
  align-items:center;
  overflow:hidden;
  box-sizing:border-box;
  border:1px solid #d8d8d8;
  border-radius:10px;
  background:#fff;
}

.create-number-field:focus-within{
  border-color:#FF0000;
  box-shadow:0 0 0 3px rgba(237,52,52,.08);
}

.create-number-field input{
  width:100%;
  height:100%;
  min-width:0;
  margin:0;
  padding:0 12px;
  border:0;
  outline:0;
  background:#fff;
  color:#222;
  font-size:14px;
  font-weight:850;
  box-shadow:none;
}

.create-number-field span{
  flex:none;
  padding:0 11px;
  color:#999;
  font-size:8px;
  font-weight:900;
}

.create-criteria small{
  display:block;
  margin-top:5px;
  color:#999;
  font-size:8px;
}

.create-cost-card{
  margin-top:15px;
  padding:14px;
  border:1px solid #ffd2d2;
  border-radius:13px;
  background:linear-gradient(145deg,#fff8f8,#fff);
}

.create-cost-head{
  display:flex;
  align-items:center;
  gap:10px;
}

.create-cost-icon{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border-radius:10px;
  background:#fff0d8;
  color:#e9a21b;
}

.create-cost-head span{
  display:block;
  color:#858585;
  font-size:9px;
  font-weight:900;
}

.create-cost-head strong{
  display:block;
  margin-top:2px;
  color:#FF0000;
  font-size:20px;
  line-height:1.1;
}

.create-cost-summary{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px;
  margin-top:12px;
}

.create-cost-summary > div{
  padding:10px 7px;
  border:1px solid #ececec;
  border-radius:9px;
  background:#fff;
  text-align:center;
}

.create-cost-summary small{
  display:block;
  color:#999;
  font-size:7px;
  font-weight:900;
}

.create-cost-summary b{
  display:block;
  margin-top:3px;
  color:#222;
  font-size:15px;
}

.create-cost-summary span{
  display:block;
  margin-top:1px;
  color:#999;
  font-size:7px;
}

.create-admin-note{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-top:12px;
  padding:11px 12px;
  border:1px solid #e6e6e6;
  border-radius:10px;
  background:#fafafa;
}

.create-admin-note b{
  color:#FF0000;
  font-size:9px;
}

.create-admin-note span{
  color:#777;
  font-size:9px;
  line-height:1.45;
}

.create-error{
  margin-top:10px;
}

.create-safe-note{
  margin-top:7px;
  text-align:center;
  color:#999;
  font-size:8px;
}

.create-cost-details{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  margin-top:10px;
}

.create-cost-details > div{
  padding:9px 7px;
  border:1px solid #ececec;
  border-radius:9px;
  background:#fff;
  text-align:center;
}

.create-cost-details small{
  display:block;
  color:#999;
  font-size:7px;
  font-weight:900;
}

.create-cost-details b{
  display:block;
  margin-top:3px;
  color:#222;
  font-size:13px;
}

@media(max-width:700px){.create-campaign-page{width:100%;padding-top:2px}
.create-page-heading h1{font-size:25px}
.create-page-heading p{font-size:10px}
.campaign-create-card{padding:12px;border-radius:15px}
.type-tabs{gap:7px}
.type-tabs button{min-height:54px;font-size:11px}
.create-url-row{gap:6px}
.create-load-btn{width:76px}}

@media(max-width:470px){.create-page-heading{margin-bottom:13px}
.create-page-heading .heading-icon{width:40px;height:40px}
.create-page-heading h1{font-size:22px}
.create-page-heading p{font-size:9px}
.type-tabs button{min-height:50px;font-size:10px}
.create-type-note{padding:9px}
.create-type-note .create-type-icon{width:34px;height:34px}
.create-criteria{gap:8px}
.create-cost-summary{gap:7px}}

/* Campaign economy / custom watch input */
.watch-entry-row{
  display:grid;
  grid-template-columns:1fr 132px;
  gap:7px;
  margin-top:7px;
}
.watch-entry-input{
  margin-top:0;
}
.watch-unit-select{
  width:100%;
  height:46px;
  padding:0 10px;
  border:1px solid #d8d8d8;
  border-radius:10px;
  background:#fff;
  color:#333;
  font-size:11px;
  font-weight:800;
  outline:none;
}
.watch-unit-select:focus{
  border-color:#FF0000;
  box-shadow:0 0 0 3px rgba(237,52,52,.08);
}
.watch-presets{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
  margin-top:7px;
}
.watch-presets button{
  min-height:28px;
  padding:0 8px;
  border:1px solid #e5e5e5;
  border-radius:7px;
  background:#fff;
  color:#666;
  font-size:8px;
  font-weight:850;
  cursor:pointer;
}
.watch-presets button:hover{
  border-color:#FF0000;
  color:#FF0000;
  background:#fff7f7;
}
.create-balance-card{
  margin-top:10px;
  padding:10px 11px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  border-radius:10px;
  border:1px solid #e6e6e6;
  background:#fafafa;
}
.create-balance-card small{
  display:block;
  color:#999;
  font-size:7px;
  font-weight:900;
}
.create-balance-card strong{
  display:block;
  margin-top:3px;
  font-size:12px;
  color:#222;
}
.create-balance-card.ready{
  border-color:#cfeedd;
  background:#f5fff8;
}
.create-balance-card.ready .balance-status{
  color:#078b43;
}
.create-balance-card.insufficient{
  border-color:#ffc4c4;
  background:#fff3f3;
}
.create-balance-card.insufficient strong,
.create-balance-card.insufficient .balance-status{
  color:#d92828;
}
.balance-status{
  font-size:8px;
  font-weight:950;
  letter-spacing:.4px;
}
.insufficient-card{
  display:flex;
  align-items:flex-start;
  gap:10px;
  margin-top:10px;
  padding:12px;
  border:1px solid #ffbcbc;
  border-radius:11px;
  background:#fff1f1;
  color:#7f2020;
}
.insufficient-icon{
  width:30px;
  height:30px;
  flex:0 0 30px;
  display:grid;
  place-items:center;
  border-radius:9px;
  background:#FF0000;
  color:#fff;
  font-size:16px;
  font-weight:950;
}
.insufficient-card b{
  display:block;
  color:#d92828;
  font-size:11px;
}
.insufficient-card span{
  display:block;
  margin-top:3px;
  color:#7f4444;
  font-size:9px;
  line-height:1.4;
}
.insufficient-card small{
  display:block;
  margin-top:5px;
  color:#a65a5a;
  font-size:8px;
}
.create-btn:disabled{
  opacity:.55;
  cursor:not-allowed;
  box-shadow:none;
}
@media(max-width:470px){
  .watch-entry-row{
    grid-template-columns:1fr 112px;
  }
}


/* =====================================================
   MOBILE CREATE CAMPAIGN CRITERIA FIX
===================================================== */
@media (max-width:600px){
  .create-campaign-page .create-criteria{
    display:grid;
    grid-template-columns:1fr;
    gap:14px;
  }
  .create-campaign-page .create-criteria > div{
    width:100%;
    min-width:0;
  }
  .create-campaign-page .watch-entry-row{
    display:grid;
    grid-template-columns:minmax(0,1fr) 125px;
    gap:8px;
    width:100%;
  }
  .create-campaign-page .watch-entry-input,
  .create-campaign-page .watch-unit-select{
    width:100%;
    min-width:0;
  }
  .create-campaign-page .create-number-field{
    width:100%;
  }
  .create-campaign-page .create-number-field input{
    min-width:0;
  }
  .create-campaign-page .watch-presets{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    width:100%;
  }
  .create-campaign-page .watch-presets button{
    min-height:30px;
    padding:0 10px;
    font-size:9px;
  }
}
@media (max-width:380px){
  .create-campaign-page .watch-entry-row{
    grid-template-columns:minmax(0,1fr) 110px;
    gap:6px;
  }
  .create-campaign-page .watch-unit-select{
    padding:0 8px;
    font-size:10px;
  }
  .create-campaign-page .watch-presets button{
    padding:0 8px;
    font-size:8px;
  }
}

@media(max-width:600px){.package-grid{grid-template-columns:1fr 1fr}.package-card strong{font-size:19px}
  .create-campaign-page .create-page-heading h1{font-size:28px}
  .create-campaign-page .create-page-heading p{font-size:12px}
  .create-campaign-page label{font-size:12px}
  .create-campaign-page .form-input,.create-campaign-page .create-input{font-size:13px}
  .create-campaign-page .create-number-field input{font-size:14px}
  .create-campaign-page .create-type-note b{font-size:13px}
  .create-campaign-page .create-type-note span{font-size:10px}
}


`;
