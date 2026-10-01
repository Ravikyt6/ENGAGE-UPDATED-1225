import React from "react";
import Layout from "@/components/Layout";
import { useData } from "@/context/DataContext";
import { Link } from "react-router-dom";
import { CircleDollarSign, Clock3, Coins, Play, Trophy, WalletCards } from "lucide-react";

export default function EarnPage() {
  const data = useData();
  const wallet = data.wallet || { coins: 0, earnings: 0 };
  const activeCampaigns = data.campaigns.filter((campaign: any) => campaign.status === "active");
  const required = activeCampaigns.length ? Math.min(...activeCampaigns.map((campaign: any) => Number(campaign.requiredWatchSeconds || 30))) : 30;

  return (
    <Layout>
      <div className="earn-page">
        <div className="earn-heading"><div className="earn-heading-icon"><Coins size={22}/></div><div><h1>Earn</h1><p>Watch content, complete required watch time and earn rewards.</p></div></div>

        <section className="earn-hero">
          <div><span>AVAILABLE COINS</span><strong>{Number(wallet.coins || 0).toLocaleString()}</strong><small>₹{Number(wallet.earnings || 0).toFixed(4)} total viewer earnings</small></div>
          <div className="earn-hero-icon"><CircleDollarSign size={31}/></div>
        </section>

        <section className="earn-grid">
          <div className="earn-card"><Clock3 size={20}/><span>Required watch time</span><b>{required}s</b></div>
          <div className="earn-card"><Trophy size={20}/><span>Active opportunities</span><b>{activeCampaigns.length}</b></div>
          <div className="earn-card"><Coins size={20}/><span>Coins balance</span><b>{Number(wallet.coins || 0).toLocaleString()}</b></div>
          <div className="earn-card"><WalletCards size={20}/><span>Wallet earnings</span><b>₹{Number(wallet.earnings || 0).toFixed(2)}</b></div>
        </section>

        <section className="earn-milestones">
          <div className="earn-section-title"><h2>View Milestones</h2><span>REWARDS</span></div>
          {(data.milestones || []).filter((m: any) => m.views > 0 && m.rewardRupees > 0).map((m: any) => (
            <div className="milestone-row" key={`${m.views}-${m.rewardRupees}`}><div><b>{m.views} qualified views</b><small>Milestone reward</small></div><strong>₹{m.rewardRupees}</strong></div>
          ))}
          <p className="milestone-note">Milestones are cumulative across eligible campaign views. Each milestone is rewarded once.</p>
        </section>

        <section className="earn-how"><div className="earn-section-title"><h2>How to earn</h2><span>LIVE</span></div><div className="earn-step"><i>1</i><div><b>Open the feed</b><p>Watch eligible Video, Short or Live content.</p></div></div><div className="earn-step"><i>2</i><div><b>Complete watch time</b><p>The green timer shows the remaining required watch time.</p></div></div><div className="earn-step"><i>3</i><div><b>Get your reward</b><p>Eligible campaign rewards are credited through the existing earning system.</p></div></div></section>

        <Link className="earn-watch-button" to="/video"><Play size={18}/> Continue Watching & Earning</Link>
      </div>
      <style>{PAGE_CSS}</style>
    </Layout>
  );
}

const PAGE_CSS = String.raw`
.earn-page{width:min(100%,760px);margin:0 auto;padding:8px 0 92px}.earn-heading{display:flex;align-items:center;gap:12px;margin-bottom:14px}.earn-heading-icon{width:48px;height:48px;border-radius:14px;background:#f3eaff;color:#a62bff;display:grid;place-items:center}.earn-heading h1{margin:0;font-size:29px;font-weight:950}.earn-heading p{margin:4px 0 0;color:#777;font-size:11px}.earn-hero{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px;border-radius:20px;background:linear-gradient(135deg,#9b28ff,#e52ba0);color:#fff;box-shadow:0 15px 34px rgba(173,38,255,.18)}.earn-hero span,.earn-hero small{display:block;font-size:8px;font-weight:900;opacity:.82}.earn-hero strong{display:block;margin:5px 0;font-size:37px;line-height:1;font-weight:950}.earn-hero-icon{width:58px;height:58px;border-radius:17px;background:rgba(255,255,255,.14);display:grid;place-items:center}.earn-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.earn-card{min-height:104px;padding:13px;border:1px solid #e9e4ed;border-radius:16px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.035)}.earn-card svg{color:#a72aff}.earn-card span,.earn-card b{display:block}.earn-card span{margin-top:12px;color:#888;font-size:9px;font-weight:800}.earn-card b{margin-top:4px;font-size:17px}.earn-milestones{margin-top:12px;padding:15px;border:1px solid #e8e8e8;border-radius:17px;background:#fff}.milestone-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #f0edf2}.milestone-row:last-of-type{border-bottom:0}.milestone-row b,.milestone-row small{display:block}.milestone-row b{font-size:10px}.milestone-row small{margin-top:3px;color:#888;font-size:8px}.milestone-row strong{font-size:16px}.milestone-note{margin:10px 0 0;color:#888;font-size:8px;line-height:1.45}.earn-how{margin-top:12px;padding:15px;border:1px solid #e8e8e8;border-radius:17px;background:#fff}.earn-section-title{display:flex;justify-content:space-between;align-items:center}.earn-section-title h2{margin:0;font-size:17px}.earn-section-title span{padding:4px 8px;border-radius:999px;background:#eafff1;color:#098b46;font-size:7px;font-weight:950}.earn-step{display:flex;gap:10px;margin-top:14px}.earn-step i{width:28px;height:28px;flex:none;border-radius:50%;display:grid;place-items:center;background:#f0e4ff;color:#9c26ff;font-style:normal;font-size:10px;font-weight:950}.earn-step b{font-size:10px}.earn-step p{margin:3px 0 0;color:#777;font-size:8.5px;line-height:1.45}.earn-watch-button{height:48px;margin-top:11px;border-radius:12px;background:#171717;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;font-size:10px;font-weight:950}.earn-watch-button:hover{background:#252525}@media(max-width:600px){.earn-page{padding:5px 0 86px}.earn-heading h1{font-size:25px}.earn-hero{padding:17px;border-radius:17px}.earn-hero strong{font-size:31px}.earn-card{min-height:96px}}@media(max-width:380px){.earn-grid{gap:7px}.earn-card{padding:10px}.earn-card span{font-size:8px}.earn-card b{font-size:15px}}
`;
