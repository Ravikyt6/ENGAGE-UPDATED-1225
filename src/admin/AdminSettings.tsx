import React, { useState } from "react";
import { Database, IndianRupee, Megaphone, PlayCircle, Radio, Save, Timer, Trophy, Zap } from "lucide-react";
import { dataProvider } from "@/services/dataProvider";
import { useData } from "@/context/DataContext";

export default function AdminSettings() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const db = dataProvider.getDB();
  const s = db.settings;
  const data = useData();

  const [interval, setIntervalValue] = useState(Number(s.adIntervalSeconds || 15));
  const [end, setEnd] = useState(Boolean(s.showAdOnEnd));
  const [enabled, setEnabled] = useState(Boolean(s.adEnabled));
  const [socialBar, setSocialBar] = useState(Boolean(s.socialBarEnabled));
  const [highRevenueBanner, setHighRevenueBanner] = useState(Boolean(s.highRevenueBannerEnabled));
  const [profitablerSquare, setProfitablerSquare] = useState(Boolean(s.profitablerSquareEnabled));
  const [vignette, setVignette] = useState(Boolean(s.monetagVignetteEnabled));
  const [pushCreated, setPushCreated] = useState(Boolean(s.monetagPushCreatedEnabled));
  const [inPagePush, setInPagePush] = useState(Boolean(s.monetagInPagePushEnabled));
  const [autoplay, setAutoplay] = useState(Boolean(s.autoplayEnabled));
  const [pricePerView, setPricePerView] = useState(Number(s.campaignPricePerView ?? 0));
  const [pricePerSecond, setPricePerSecond] = useState(Number(s.campaignPricePerSecond ?? 0.0266666667));
  const [viewOptions, setViewOptions] = useState<number[]>(Array.isArray(s.campaignViewOptions) && s.campaignViewOptions.length ? s.campaignViewOptions : [10,25,50,100,250,500,1000]);
  const [watchOptions, setWatchOptions] = useState<number[]>(Array.isArray(s.campaignWatchSecondOptions) && s.campaignWatchSecondOptions.length ? s.campaignWatchSecondOptions : [15,30,45,60]);
  const [newViewOption, setNewViewOption] = useState("");
  const [newWatchOption, setNewWatchOption] = useState("");
  const [mode, setMode] = useState(localStorage.getItem("engage_runtime_mode") || "local");
  const [saved, setSaved] = useState(false);

  function save() {
    const safeInterval = Math.max(1, Math.floor(Number(interval) || 1));

    dataProvider.updateSettings({
      adIntervalSeconds: safeInterval,
      showAdOnEnd: end,
      adEnabled: enabled,
      socialBarEnabled: socialBar,
      highRevenueBannerEnabled: highRevenueBanner,
      profitablerSquareEnabled: profitablerSquare,
      monetagVignetteEnabled: vignette,
      monetagPushCreatedEnabled: pushCreated,
      monetagInPagePushEnabled: inPagePush,
      autoplayEnabled: autoplay,
      campaignPricePerView: Math.max(0, Number(pricePerView) || 0),
      campaignPricePerSecond: Math.max(0, Number(pricePerSecond) || 0),
      campaignViewOptions: [...viewOptions].map(Number).filter((v) => Number.isFinite(v) && v > 0),
      campaignWatchSecondOptions: [...watchOptions].map(Number).filter((v) => Number.isFinite(v) && v > 0),
    });

    void data.refresh();
    setIntervalValue(safeInterval);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }


  function addViewOption() {
    const value = Math.floor(Number(newViewOption));
    if (!Number.isFinite(value) || value < 1 || viewOptions.includes(value)) return;
    setViewOptions([...viewOptions, value].sort((a, b) => a - b));
    setNewViewOption("");
  }

  function addWatchOption() {
    const value = Math.floor(Number(newWatchOption));
    if (!Number.isFinite(value) || value < 1 || watchOptions.includes(value)) return;
    setWatchOptions([...watchOptions, value].sort((a, b) => a - b));
    setNewWatchOption("");
  }

  function removeViewOption(value: number) {
    if (viewOptions.length <= 1) return;
    setViewOptions(viewOptions.filter((item) => item !== value));
  }

  function removeWatchOption(value: number) {
    if (watchOptions.length <= 1) return;
    setWatchOptions(watchOptions.filter((item) => item !== value));
  }

  function switchMode(next: string) {
    if (next === "supabase") {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        alert("Supabase environment variables are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.");
        return;
      }

      localStorage.setItem("engage_runtime_mode", "supabase");
      setMode("supabase");
      alert("LIVE MODE enabled. Reloading… Local application data will no longer be used for application data.");
      window.location.reload();
      return;
    }

    localStorage.setItem("engage_runtime_mode", "local");
    setMode("local");
    window.location.reload();
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-head settings-page-head">
        <div>
          <h1>Settings</h1>
          <p>Manage campaign pricing, advertisements, autoplay and application storage.</p>
        </div>
      </div>

      {/* STORAGE */}
      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><Database size={18} /></div>
          <div>
            <h2>Data Storage</h2>
            <p>Choose where application data is stored.</p>
          </div>
        </div>

        <div className="storage-card">
          <div>
            <b>APPLICATION STORAGE</b>
            <span className={mode === "supabase" ? "live-text" : "local-text"}>
              {mode === "supabase" ? "LIVE • SUPABASE" : "LOCAL • DEVELOPMENT"}
            </span>
          </div>

          <div className="mode-toggle">
            <button className={mode === "local" ? "active" : ""} onClick={() => switchMode("local")}>LOCAL</button>
            <button className={mode === "supabase" ? "active live" : ""} onClick={() => switchMode("supabase")}>LIVE</button>
          </div>
        </div>
      </section>

      {/* CAMPAIGN PRICING */}
      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><IndianRupee size={18} /></div>
          <div>
            <h2>Campaign Pricing</h2>
            <p>Creator campaign cost is calculated from these Admin-controlled rates.</p>
          </div>
        </div>
        <div className="ads-grid">
          <div className="setting-control-card">
            <div className="control-card-icon"><IndianRupee size={17} /></div>
            <div className="control-card-content">
              <b>Cost Per View</b>
              <span>Fixed amount added for every requested campaign view.</span>
              <div className="control-input-wrap">
                <input type="number" min="0" step="0.0001" value={pricePerView} onChange={(e) => setPricePerView(Number(e.target.value))} />
                <em>₹ / VIEW</em>
              </div>
            </div>
          </div>
          <div className="setting-control-card">
            <div className="control-card-icon"><Timer size={17} /></div>
            <div className="control-card-content">
              <b>Cost Per Second</b>
              <span>Amount added for every required watch second across all requested views.</span>
              <div className="control-input-wrap">
                <input type="number" min="0" step="0.000001" value={pricePerSecond} onChange={(e) => setPricePerSecond(Number(e.target.value))} />
                <em>₹ / SEC</em>
              </div>
            </div>
          </div>
        </div>
        <div className="economy-note" style={{marginTop:10}}>
          <b>Formula</b>
          <span>Campaign Cost = Views × Cost Per View + (Views × Watch Seconds Per User × Cost Per Second).</span>
        </div>

        <div className="campaign-options-admin">
          <div className="campaign-option-editor">
            <div className="campaign-option-head">
              <div><b>NUMBER OF VIEWS DROPDOWN</b><span>These values appear in Creator → Create Campaign.</span></div>
            </div>
            <div className="campaign-option-add-row">
              <input type="number" min="1" step="1" value={newViewOption} onChange={(e) => setNewViewOption(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addViewOption(); }} placeholder="Add views e.g. 2000" />
              <button type="button" onClick={addViewOption}>ADD</button>
            </div>
            <div className="campaign-option-chips">
              {viewOptions.map((value) => <span key={value}>{value.toLocaleString()}<button type="button" onClick={() => removeViewOption(value)} aria-label={`Remove ${value} views`}>×</button></span>)}
            </div>
          </div>

          <div className="campaign-option-editor">
            <div className="campaign-option-head">
              <div><b>TIME REQUIRED DROPDOWN</b><span>Seconds shown in the Creator watch-time selector. Shorts automatically hides 60+ seconds.</span></div>
            </div>
            <div className="campaign-option-add-row">
              <input type="number" min="1" step="1" value={newWatchOption} onChange={(e) => setNewWatchOption(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWatchOption(); }} placeholder="Add seconds e.g. 90" />
              <button type="button" onClick={addWatchOption}>ADD</button>
            </div>
            <div className="campaign-option-chips">
              {watchOptions.map((value) => <span key={value}>{value}s<button type="button" onClick={() => removeWatchOption(value)} aria-label={`Remove ${value} seconds`}>×</button></span>)}
            </div>
          </div>
        </div>
      </section>

      {/* ADS */}
      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><Megaphone size={18} /></div>
          <div>
            <h2>Advertisement Controls</h2>
            <p>Control when playback advertisements appear inside the application.</p>
          </div>
        </div>

        <div className="ads-grid">
          <div className="setting-control-card">
            <div className="control-card-icon"><Timer size={17} /></div>
            <div className="control-card-content">
              <b>Ad Popup Interval</b>
              <span>Playback seconds between advertisement prompts.</span>
              <div className="control-input-wrap">
                <input type="number" min="1" value={interval} onChange={(e) => setIntervalValue(Number(e.target.value))} />
                <em>SECONDS</em>
              </div>
            </div>
          </div>

          <div className="setting-control-card">
            <div className="control-card-icon"><PlayCircle size={17} /></div>
            <div className="control-card-content">
              <b>Playback Ads</b>
              <span>Allow advertisement popups during qualified playback.</span>
              <div className="select-wrap">
                <select value={enabled ? "yes" : "no"} onChange={(e) => setEnabled(e.target.value === "yes")}>
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="setting-control-card">
            <div className="control-card-icon"><Radio size={17} /></div>
            <div className="control-card-content">
              <b>Ad on Watch Target / Video End</b>
              <span>Show an advertisement when the watch target or video ends.</span>
              <div className="select-wrap">
                <select value={end ? "yes" : "no"} onChange={(e) => setEnd(e.target.value === "yes")}>
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BEHAVIOUR */}
      <section className="settings-section">
        <div className="settings-section-heading">
          <div className="settings-section-icon"><Zap size={18} /></div>
          <div>
            <h2>Viewer Behaviour</h2>
            <p>Control automatic content progression and social advertisements.</p>
          </div>
        </div>

        <div className="behaviour-grid">
          <div className="admin-toggle-row">
            <div className="toggle-copy"><div className="toggle-title-line"><Megaphone size={15} /><b>HighRevenue 728×90 Banner</b></div><small>Controls the HighRevenueFormat banner shown below the video watch controls.</small></div>
            <button type="button" className={`switch ${highRevenueBanner ? "on" : ""}`} onClick={() => setHighRevenueBanner(!highRevenueBanner)} aria-label="Toggle HighRevenue banner"><i /></button>
          </div>

          <div className="admin-toggle-row">
            <div className="toggle-copy"><div className="toggle-title-line"><Megaphone size={15} /><b>Profitableratecpm Square Popup</b></div><small>Controls the square advertisement displayed in the video popup.</small></div>
            <button type="button" className={`switch ${profitablerSquare ? "on" : ""}`} onClick={() => setProfitablerSquare(!profitablerSquare)} aria-label="Toggle Profitabler square popup"><i /></button>
          </div>

          <div className="admin-toggle-row">
            <div className="toggle-copy">
              <div className="toggle-title-line"><Megaphone size={15} /><b>Social Bar Advertisement</b></div>
              <small>Enable or disable the Social Bar advertisement script across the application.</small>
            </div>
            <button type="button" className={`switch ${socialBar ? "on" : ""}`} onClick={() => setSocialBar(!socialBar)} aria-label="Toggle social bar advertisement">
              <i />
            </button>
          </div>


          <div className="admin-toggle-row">
            <div className="toggle-copy"><div className="toggle-title-line"><Megaphone size={15} /><b>Monetag Vignette</b></div><small>Zone 11673586. Toggle the Vignette advertisement independently.</small></div>
            <button type="button" className={`switch ${vignette ? "on" : ""}`} onClick={() => setVignette(!vignette)} aria-label="Toggle Monetag Vignette"><i /></button>
          </div>
          <div className="admin-toggle-row">
            <div className="toggle-copy"><div className="toggle-title-line"><Megaphone size={15} /><b>Monetag Push Created</b></div><small>Zone 11673612. Toggle the Push Created advertisement independently.</small></div>
            <button type="button" className={`switch ${pushCreated ? "on" : ""}`} onClick={() => setPushCreated(!pushCreated)} aria-label="Toggle Monetag Push Created"><i /></button>
          </div>
          <div className="admin-toggle-row">
            <div className="toggle-copy"><div className="toggle-title-line"><Megaphone size={15} /><b>Monetag In-Page Push</b></div><small>Zone 11673630. Toggle the In-Page Push advertisement independently.</small></div>
            <button type="button" className={`switch ${inPagePush ? "on" : ""}`} onClick={() => setInPagePush(!inPagePush)} aria-label="Toggle Monetag In-Page Push"><i /></button>
          </div>

          <div className="admin-toggle-row">
            <div className="toggle-copy">
              <div className="toggle-title-line"><Zap size={15} /><b>User Autoplay</b></div>
              <small>After a qualified watch target and ad close, automatically start the next eligible content.</small>
            </div>
            <button type="button" className={`switch ${autoplay ? "on" : ""}`} onClick={() => setAutoplay(!autoplay)} aria-label="Toggle autoplay">
              <i />
            </button>
          </div>
        </div>
      </section>

      {/* SAVE */}
      <div className="settings-save-bar">
        <div>
          {saved ? <><b>Settings Saved</b><span>Advertisement and viewer behaviour settings were updated.</span></> : <><b>Apply Changes</b><span>Changes are applied to the active storage mode.</span></>}
        </div>
        <button className="primary settings-save-btn" onClick={save}>
          <Save size={17} /> SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}

/* ===== ADMIN SETTINGS CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.admin-settings-page{max-width:980px;margin:0 auto;padding-bottom:40px;}
.settings-page-head{margin-bottom:18px;}
.settings-section{margin:0 0 18px;padding:16px;border:1px solid #e7e7e7;border-radius:14px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.035);}
.settings-section-heading{display:flex;align-items:center;gap:11px;margin-bottom:14px;}
.settings-section-heading h2{margin:0;color:#222;font-size:15px;font-weight:900;}
.settings-section-heading p{margin:4px 0 0;color:#888;font-size:9px;line-height:1.45;}
.settings-section-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:10px;background:#f4f4f4;color:#FF0000;}
.settings-section-icon.economy-icon{background:#fff2d7;color:#d99718;}
.storage-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px;border:1px solid #e9e9e9;border-radius:11px;background:#fafafa;}
.storage-card b{display:block;color:#555;font-size:9px;font-weight:900;letter-spacing:.4px;}
.storage-card span{display:block;margin-top:4px;font-size:10px;font-weight:900;}
.local-text{color:#777;}.live-text{color:#079447;}
.mode-toggle{display:flex;gap:3px;padding:3px;border-radius:9px;background:#ededed;}
.mode-toggle button{min-width:60px;border:0;border-radius:7px;padding:8px 10px;background:transparent;color:#777;font-size:8px;font-weight:950;cursor:pointer;}
.mode-toggle button.active{background:#fff;color:#FF0000;box-shadow:0 1px 5px rgba(0,0,0,.08);}.mode-toggle button.active.live{color:#079447;}
.economy-rule-card{padding:13px;border:1px solid #ffe0e0;border-radius:11px;background:#fff8f8;}
.economy-rule-main{display:flex;align-items:flex-start;gap:10px;}.economy-rule-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:9px;background:#FF0000;color:#fff;}
.economy-rule-main b{display:block;color:#444;font-size:10px;}.economy-rule-main span{display:block;margin-top:4px;color:#777;font-size:9px;line-height:1.45;}
.economy-formula{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:9px 10px;border-radius:8px;background:#fff;border:1px solid #eee;}.economy-formula span{color:#999;font-size:7px;font-weight:950;}.economy-formula strong{color:#222;font-size:9px;text-align:right;}
.economy-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;}.economy-stat{padding:10px 8px;border:1px solid #e8e8e8;border-radius:9px;text-align:center;background:#fff;}.economy-stat small{display:block;color:#999;font-size:7px;font-weight:950;}.economy-stat b{display:block;margin-top:4px;color:#FF0000;font-size:14px;}.economy-stat span{display:block;margin-top:2px;color:#999;font-size:7px;}
.economy-examples{margin-top:10px;border:1px solid #eee;border-radius:10px;overflow:hidden;}.economy-example-title{padding:8px 10px;background:#f7f7f7;color:#777;font-size:7px;font-weight:950;letter-spacing:.8px;}.economy-example-row{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-top:1px solid #eee;font-size:9px;color:#555;}.economy-example-row b{color:#222;}.economy-note{margin-top:10px;padding:10px;border-radius:9px;background:#fafafa;border:1px solid #eee;}.economy-note b{display:block;color:#555;font-size:9px;}.economy-note span{display:block;margin-top:3px;color:#888;font-size:8px;line-height:1.45;}

.campaign-options-admin{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.campaign-option-editor{padding:12px;border:1px solid #e8e8e8;border-radius:11px;background:#fafafa}.campaign-option-head b,.campaign-option-head span{display:block}.campaign-option-head b{font-size:9px;color:#444;font-weight:950}.campaign-option-head span{margin-top:4px;color:#888;font-size:8px;line-height:1.45}.campaign-option-add-row{display:flex;gap:7px;margin-top:9px}.campaign-option-add-row input{flex:1;min-width:0;height:36px;padding:0 9px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#222;font-size:9px;font-weight:700;outline:none}.campaign-option-add-row button{height:36px;padding:0 13px;border:0;border-radius:8px;background:#FF0000;color:#fff;font-size:8px;font-weight:950;cursor:pointer}.campaign-option-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.campaign-option-chips>span{display:inline-flex;align-items:center;gap:5px;padding:6px 7px 6px 9px;border-radius:999px;background:#fff;border:1px solid #e4e4e4;color:#444;font-size:8px;font-weight:900}.campaign-option-chips button{width:17px;height:17px;padding:0;border:0;border-radius:50%;background:#eee;color:#777;font-size:12px;line-height:17px;cursor:pointer}.campaign-option-chips button:hover{background:#ddd}@media(max-width:760px){.campaign-options-admin{grid-template-columns:1fr}}
.ads-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}.setting-control-card{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #e8e8e8;border-radius:11px;background:#fff;}.control-card-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:9px;background:#f7f7f7;color:#FF0000;}.control-card-content{min-width:0;flex:1;}.control-card-content>b{display:block;color:#444;font-size:10px;}.control-card-content>span{display:block;margin-top:4px;color:#888;font-size:8px;line-height:1.45;}.control-input-wrap,.select-wrap{position:relative;margin-top:8px;}.control-input-wrap input,.select-wrap select{width:100%;height:38px;box-sizing:border-box;padding:0 10px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#222;font-size:10px;font-weight:800;outline:none;}.control-input-wrap input{padding-right:55px;}.control-input-wrap em{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-style:normal;color:#999;font-size:7px;font-weight:950;}
.behaviour-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.admin-toggle-row{min-height:82px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e8e8e8;border-radius:11px;background:#fff;}.toggle-copy{min-width:0;}.toggle-title-line{display:flex;align-items:center;gap:6px;color:#444;}.toggle-title-line svg{color:#FF0000;flex:none;}.toggle-title-line b{font-size:10px;}.toggle-copy small{display:block;margin-top:5px;color:#888;font-size:8px;line-height:1.45;}.switch{width:44px;height:24px;flex:0 0 44px;padding:3px;border:0;border-radius:20px;background:#d8d8d8;cursor:pointer;position:relative;transition:background .18s ease;}.switch i{display:block;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .18s ease;}.switch.on{background:#FF0000;}.switch.on i{transform:translateX(20px);}
.settings-save-bar{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 16px;border:1px solid #e8e8e8;border-radius:13px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.04);}.settings-save-bar b{display:block;color:#333;font-size:10px;}.settings-save-bar span{display:block;margin-top:3px;color:#888;font-size:8px;}.settings-save-btn{display:flex;align-items:center;gap:7px;white-space:nowrap;}
@media(max-width:760px){.economy-stat-grid{grid-template-columns:repeat(2,1fr);}.ads-grid,.behaviour-grid,.milestone-admin-grid{grid-template-columns:1fr;}}
@media(max-width:520px){.settings-section{padding:12px;}.settings-section-heading h2{font-size:13px;}.storage-card,.settings-save-bar{align-items:flex-start;flex-direction:column;}.mode-toggle{width:100%;}.mode-toggle button{flex:1;}.economy-formula{align-items:flex-start;flex-direction:column;gap:5px;}.economy-formula strong{text-align:left;}.economy-stat-grid{grid-template-columns:1fr 1fr;}.settings-save-btn{width:100%;justify-content:center;}.admin-toggle-row{min-height:88px;}}
`;
