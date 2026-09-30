import Layout from "@/components/Layout";
import { NativePopup } from "@/components/NativeAd";
import YouTubePlayer, { PlayerState, YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { dataProvider } from "@/services/dataProvider";
import { Ban, CheckCircle2 as CheckIcon, RefreshCw, Video as VideoIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";


function HighRevenueBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  const bannerUrl =
    "https://www.profitableratecpmnetwork.com/k8b1cp18s0?key=5b244a28bde2dfe01f4224f1c7048748";

  return (
    <div className="highrevenue-banner-wrap" aria-label="Advertisement">
      <div className="highrevenue-banner-label">ADVERTISEMENT</div>
      <div className="highrevenue-banner-slot">
        <iframe
          title="Sponsored Advertisement"
          src={bannerUrl}
          loading="lazy"
          scrolling="no"
          frameBorder="0"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default function VideoPage(){
  /*
   * Inject VideoPage CSS before the browser paints.
   * The previous useEffect ran after paint, which caused a one-frame
   * unstyled/old-looking Video UI flash when coming from Shorts via
   * the bottom navigation.
   */
  React.useLayoutEffect(() => {
    const existing = document.querySelector(
      'style[data-engage-style="VIDEO_PAGE_CSS"]'
    );

    if (existing) return;

    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "VIDEO_PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

 const {user}=useAuth();
 const data=useData();
 const playerRef=useRef<YouTubePlayerHandle>(null);
 const db=dataProvider.getDB();
 const [watchedIds,setWatchedIds]=useState<string[]>([]);
 const [watchedLoading,setWatchedLoading]=useState(true);
 const [autoplay,setAutoplay]=useState(true);
 const [i,setI]=useState(0),[state,setState]=useState<PlayerState>("UNKNOWN");
 const [duration,setDuration]=useState(0),[watched,setWatched]=useState(0);
 const [ad,setAd]=useState(false),[qualified,setQualified]=useState(false),[rewardToast,setRewardToast]=useState("");
 const last=useRef(0);
 const intervalAdShown=useRef(false);
 const endAdShown=useRef(false);
 const qualificationPending=useRef(false);
 const [hasStarted,setHasStarted]=useState(false);
 const [milestoneViews,setMilestoneViews]=useState(0);
 const [milestoneCompleted,setMilestoneCompleted]=useState<number[]>([]);

 const loadMilestones=React.useCallback(()=>{
   if(!user?.id) return;
   try{
     const state=JSON.parse(localStorage.getItem("engage_view_milestones_v1")||"{}") as Record<string,number[]>;
     const completed=Array.isArray(state[user.id])?state[user.id]:[];
     const total=Object.keys(localStorage).filter(key=>
       key.startsWith("engage_campaign_qualification_") && key.endsWith(`_${user.id}`)
     ).length;
     setMilestoneViews(total);
     setMilestoneCompleted(completed);
   }catch{
     setMilestoneViews(0);
     setMilestoneCompleted([]);
   }
 },[user?.id]);

 useEffect(()=>{ loadMilestones(); },[loadMilestones]);

 useEffect(()=>{
   if(!user?.id){
     setWatchedIds([]);
     setWatchedLoading(false);
     return;
   }

   setWatchedLoading(true);
   dataProvider.getWatchedContentIds(user.id)
     .then(setWatchedIds)
     .catch((error)=>{
       console.error(error);
       setWatchedIds([]);
     })
     .finally(()=>setWatchedLoading(false));
 },[user?.id]);

 const videos=db.contents.filter(c=>
   c.type==="video" &&
   c.creatorId!==user?.id &&
   !watchedIds.includes(c.id)
 );

 useEffect(()=>{
   if(i>=videos.length) setI(0);
 },[videos.length,i]);

 const v=videos[i]||videos[0];
 const creatorProfile=v?.creatorId ? db.users.find(u=>u.id===v.creatorId) : undefined;
 const creatorAvatar=(creatorProfile as any)?.avatarUrl || null;
 const campaign=v
   ? db.campaigns.find(c=>
       c.type==="video" &&
       c.status==="active" &&
       c.contentId===v.id
     ) || db.campaigns.find(c=>
       c.type==="video" &&
       c.status==="active" &&
       c.creatorId!==user?.id
     )
   : undefined;

 const settings=db.settings;
 const target=campaign?.requiredWatchSeconds||30;
 const progress=target>0 ? Math.min(100,(watched/target)*100) : 0;

 useEffect(()=>{
   setWatched(0);
   setQualified(false);
   last.current=0;
   intervalAdShown.current=false;
   endAdShown.current=false;
   qualificationPending.current=false;
   setHasStarted(false);
   setAd(false);
 },[v?.id,campaign?.id,target]);

 function onTime(cur:number,dur:number){
   setDuration(dur);

   if(state==="PLAYING"){
     if(last.current>0){
       const delta=cur-last.current;

       // Count only normal playback progression. This prevents seeking from
       // being converted into qualified watch time.
       if(delta>0 && delta<=1.2){
         setWatched(x=>Math.min(target,x+delta));
       }
     }

     last.current=cur;

     if(
       settings.adEnabled &&
       settings.profitablerSquareEnabled &&
       settings.adIntervalSeconds>0 &&
       !intervalAdShown.current &&
       cur>=settings.adIntervalSeconds
     ){
       intervalAdShown.current=true;
       playerRef.current?.pauseVideo();
       setAd(true);
     }
   }else{
     last.current=cur;
   }
 }

 function stateChange(s:PlayerState){
   setState(s);

   if(s==="PLAYING"){
     setHasStarted(true);
     last.current=0;
   }

   if(s!=="PLAYING"){
     last.current=0;
   }

   if(s==="ENDED"){
     // For campaign videos, qualification is based on the verified watch
     // timer, not merely on the YouTube player reaching its natural end.
     if(!campaign && v && user){
       dataProvider.markContentWatched(user.id,v.id)
         .then(()=>setWatchedIds(x=>x.includes(v.id)?x:[...x,v.id]))
         .catch(console.error);
     }
   }
 }

 function next(){
   if(!videos.length) return;
   setI(x=>(x+1)%videos.length);
   if(autoplay){
     window.setTimeout(()=>playerRef.current?.playVideo(),500);
   }
 }

 async function completeCampaign(){
   if(!campaign || !user || !v || qualified) return;

   try{
     await dataProvider.qualify(campaign.id,user.id);
     await dataProvider.markContentWatched(user.id,v.id);
     setWatchedIds(x=>x.includes(v.id)?x:[...x,v.id]);
     await data.refresh();
     loadMilestones();

     setQualified(true);

     const coins=Number(campaign.coinRewardPerUser||0);
     const dollars=Number(campaign.dollarRewardPerUser||0);

     setRewardToast(
       `Qualified view added • milestone progress updated`
     );

     window.setTimeout(()=>setRewardToast(""),4500);
   }catch(e){
     console.error(e);
     setQualified(false);
   }finally{
     qualificationPending.current=false;
   }
 }

 


 function closeAd(){
   setAd(false);

   window.setTimeout(()=>{
     if(qualificationPending.current){
       void completeCampaign();
       return;
     }

   },150);
 }

 useEffect(()=>{
   if(
     watched>=target &&
     !qualified &&
     !qualificationPending.current &&
     campaign &&
     user &&
     v
   ){
     qualificationPending.current=true;

     // The end ad must be shown before the reward/qualification RPC.
     if(settings.adEnabled && settings.profitablerSquareEnabled && settings.showAdOnEnd && !endAdShown.current){
       endAdShown.current=true;
       playerRef.current?.pauseVideo();
       setAd(true);
     }else{
       void completeCampaign();
     }
   }
 },[watched,target,qualified,campaign?.id,user?.id,v?.id,settings.adEnabled,settings.profitablerSquareEnabled,settings.showAdOnEnd]);

 if(data.loading || watchedLoading){
   return <Layout>
     <div className="video-empty-state video-loading-state" aria-busy="true">
       <div className="video-empty-icon loading-icon"><VideoIcon size={25}/></div>
       <div className="video-skeleton-line large" />
       <div className="video-skeleton-line" />
       <div className="video-skeleton-card" />
       <span>Loading videos…</span>
     </div>
   </Layout>
 }

 if(!v){
   return <Layout>
     <div className="video-empty-state">
       <div className="video-empty-icon"><Ban size={27}/></div>
       <h2>You're all caught up</h2>
       <p>There are no new eligible videos for you right now.</p>
       <button
         type="button"
         className="video-refresh-btn"
         onClick={()=>void data.refresh()}
       >
         <RefreshCw size={16}/>
         CHECK AGAIN
       </button>
     </div>
   </Layout>
 }

 const activeMilestone = milestoneCompleted.includes(50)
   ? (milestoneCompleted.includes(100) ? null : { views: 100, reward: 20 })
   : { views: 50, reward: 10 };

 return <Layout>
   {rewardToast&&
     <div className="reward-toast">
       <CheckIcon/>
       <div>
         <b>Milestone Progress Updated!</b>
         <span>{rewardToast}</span>
       </div>
     </div>
   }

   {!campaign && (
     <div className="feed-tabs" role="tablist" aria-label="Video feed">
       <button className="feed-tab active" type="button">For You</button>
       <button className="feed-tab" type="button">Following</button>
       <button className="feed-tab" type="button">Trending</button>
     </div>
   )}

   <div className="content-head">
     <div className="content-title-wrap">
       <div className="content-kicker">{campaign ? "CAMPAIGN WATCH" : "WATCH & EARN"}</div>
       <h1>{campaign?"Campaign Watch":"Watch & Earn"}</h1>
       <p>
         {campaign
           ? `${campaign.targetViews} verified views • ${target}s required`
           : "Watch new sponsored YouTube videos and earn"}
       </p>
     </div>
     <div className={`status-pill ${state === "PLAYING" ? "playing" : ""}`}>
       <span className="status-dot" />{state==="PLAYING"?"PLAYING":"READY"}
     </div>
   </div>

   <div className="player-card">
     <div className="player-wrap">
       <YouTubePlayer
         ref={playerRef}
         key={v.id}
         videoId={v.youtubeVideoId}
         autoplay={false}
         minimalUi
         overlayTitle={v.creator || "ENGAGE"}
         overlaySubtitle={v.title}
         overlayAvatarUrl={creatorAvatar}
         showZoom
         onStateChange={stateChange}
         onTime={onTime}
       />




     </div>

     <div className="player-meta">
       <div>
         <b>{v.title}</b>
         <span>{v.creator}</span>
       </div>
     </div>
   </div>

   <div className="watch-progress-strip">
     <div className="watch-progress-track"><i style={{ width: `${progress}%` }} /></div>
     <span>{Math.round(progress)}% watched</span>
   </div>

   <div className="watch-control-card">
     <div className="watch-control-item watch-timer">
       <b>{Math.max(0, Math.ceil(target - watched))}s</b>
        <small>SECONDS</small>
     </div>

     <div className="autoplay-control">
       <span>Autoplay</span>
       <button
         type="button"
         className={`autoplay-toggle ${autoplay ? "on" : ""}`}
         aria-label={`Autoplay ${autoplay ? "on" : "off"}`}
         aria-pressed={autoplay}
         onClick={()=>setAutoplay(v=>!v)}
       ><span /></button>
     </div>

     <div className="watch-control-item watch-total">
       <b>₹{Number(data.wallet?.earnings || 0).toFixed(2)}</b>
       <small>TOTAL EARNED</small>
     </div>
   </div>

   {campaign&&(() => {
     const milestoneDefs = (data.milestones || []).filter((m:any) => m.active !== false && Number(m.views) > 0 && Number(m.rewardRupees) > 0).map((m:any) => ({ views:Number(m.views), reward:Number(m.rewardRupees) })).sort((a:any,b:any)=>a.views-b.views);
     const activeMilestone = milestoneDefs.find((m) => !milestoneCompleted.includes(m.views)) || null;
     const milestoneProgress = activeMilestone ? Math.min(100, Math.round((milestoneViews / activeMilestone.views) * 100)) : 100;
     return <div className="watch-reward-card">
       <div className="watch-reward-head">
         <div className="watch-reward-icon">🏆</div>
         <div className="watch-reward-title"><strong>{activeMilestone ? "Next View Milestone" : "Milestones Completed"}</strong><span>{activeMilestone ? "Complete qualified views to unlock your next bonus" : "All available view milestones are complete"}</span></div>
         <div className="watch-reward-count">{milestoneViews}</div>
       </div>
       {activeMilestone ? (
         <>
           <div className="watch-reward-progress-row">
             <div className="watch-reward-label"><b>{activeMilestone.views} views</b><span>₹{activeMilestone.reward} bonus</span></div>
             <div className="watch-reward-progress"><div><i style={{width:`${milestoneProgress}%`}} /></div><small>{Math.min(milestoneViews,activeMilestone.views)}/{activeMilestone.views}</small></div>
             <strong>₹{activeMilestone.reward}</strong>
           </div>
           <div className="watch-reward-note">Complete this video to add one qualified view toward this milestone.</div>
         </>
       ) : (
         <div className="watch-reward-complete">✓ All view milestones completed</div>
       )}
     </div>;
   })()}
   <div className="actions-row">
     {!hasStarted ? (
       <button
         className="primary"
         onClick={()=>playerRef.current?.playVideo()}
       >
         START
       </button>
     ) : (
       <button className="primary" onClick={next}>
         NEXT VIDEO
       </button>
     )}
   </div>

   <div className="item-note">
     Timer stops automatically on pause, buffering or video end.
     Once this video is watched, it will not be shown again to the same user.
   </div>

   {qualified&&
     <div className="qualified">
       ✓ Qualified view completed — milestone progress updated
     </div>
   }

    <HighRevenueBanner enabled={Boolean(settings.highRevenueBannerEnabled)} />
{ad&&
     <div className="video-ad-overlay" role="dialog" aria-modal="true">
       <div className="video-ad-modal">
         <NativePopup onClose={closeAd} profitablerEnabled={Boolean(settings.profitablerSquareEnabled)}/>
       </div>
     </div>
   }
 </Layout>
}

function format(s:number){
 const m=Math.floor(s/60);
 const sec=Math.floor(s%60);
 return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

/* ===== VIDEOPAGE CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.feed-tabs{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  margin:0 0 12px;
  padding:3px;
  background:#f5f5f5;
  border:1px solid #ededed;
  border-radius:999px;
}
.feed-tab{
  flex:1;
  min-height:38px;
  padding:0 13px;
  border:0;
  border-radius:999px;
  background:transparent;
  color:#777;
  font-size:11px;
  font-weight:900;
  white-space:nowrap;
}
.feed-tab.active{background:#ff0000;color:#fff;box-shadow:0 4px 12px rgba(255,0,0,.18)}
.content-title-wrap{min-width:0}
.content-kicker{font-size:8px;line-height:1;font-weight:950;letter-spacing:1px;color:#ff0000;margin-bottom:5px}
.status-pill{display:flex;align-items:center;gap:5px;padding:7px 10px;border-radius:999px;background:#fff3f3;color:#d82424}
.status-pill.playing{background:#effff5;color:#0b9348}
.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:block}
.watch-progress-strip{display:flex;align-items:center;gap:8px;margin:9px 0 2px}.watch-progress-track{height:4px;flex:1;border-radius:99px;background:#ececec;overflow:hidden}.watch-progress-track i{display:block;height:100%;border-radius:99px;background:#22c866;transition:width .2s linear}.watch-progress-strip>span{flex:none;font-size:8px;font-weight:900;color:#888;min-width:66px;text-align:right}
.video-empty-state{
  min-height:calc(100vh - 250px);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  padding:34px 20px;
  border:1px solid #ececec;
  border-radius:16px;
  background:linear-gradient(180deg,#fff,#fffafa);
  box-shadow:0 8px 24px rgba(0,0,0,.04);
}
.video-empty-icon{width:64px;height:64px;display:grid;place-items:center;border-radius:18px;background:#fff0f0;color:#FF0000;margin-bottom:15px}
.video-empty-state h2{margin:0;color:#222;font-size:20px;font-weight:950}
.video-empty-state p{max-width:360px;margin:7px 0 18px;color:#777;font-size:12px;line-height:1.5}
.video-refresh-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 18px;border:0;border-radius:9px;background:#FF0000;color:#fff;font-size:10px;font-weight:950;cursor:pointer}
.video-loading-state>span{margin-top:13px;color:#999;font-size:10px;font-weight:800}
.video-skeleton-line{width:min(260px,75%);height:10px;margin:5px 0;border-radius:99px;background:#eee;animation:videoPulse 1.1s ease-in-out infinite}
.video-skeleton-line.large{width:min(330px,82%);height:15px}
.video-skeleton-card{width:min(620px,92%);aspect-ratio:16/7;margin-top:20px;border-radius:12px;background:#f1f1f1;animation:videoPulse 1.1s ease-in-out infinite}
@keyframes videoPulse{0%,100%{opacity:.55}50%{opacity:1}}

.player-card,
.live-card{
  width:100%;
  box-sizing:border-box;
  border-radius:10px;
  overflow:hidden;
  background:#050505;
  box-shadow:0 3px 15px #0002;
}

.player-wrap,
.live-player{
  position:relative;
  width:100%;
  height:auto;
  aspect-ratio:16 / 9;
  min-height:0 !important;
  background:#000;
  overflow:hidden;
}

.player-wrap .yt-wrap{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  min-height:0 !important;
  max-height:none !important;
  overflow:hidden !important;
}

.player-wrap .yt-inner{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  min-height:0 !important;
  overflow:hidden !important;
}

.player-wrap .yt-inner > div,
.player-wrap .yt-inner iframe{
  position:absolute !important;
  inset:0 !important;
  display:block !important;
  width:100% !important;
  height:100% !important;
  min-width:100% !important;
  min-height:100% !important;
  max-width:none !important;
  max-height:none !important;
  border:0 !important;
}

.player-meta,
.short-info,
.live-meta{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-height:62px;
  box-sizing:border-box;
  padding:12px;
  background:#111;
  color:#fff;
}

.player-meta > div:first-child{
  min-width:0;
  flex:1;
}

.player-meta b,
.short-info b,
.live-meta b{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:14px;
}

.player-meta span,
.short-info span,
.live-meta span{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
  color:#999;
  margin-top:4px;
}

.duration{
  flex:none;
  font-weight:900;
  color:#fff;
}

.watch-control-card{
 width:100%;
 box-sizing:border-box;
 min-height:70px;
 display:grid;
 grid-template-columns:1fr 1fr 1fr;
 align-items:center;
 gap:10px;
 padding:9px 12px;
 margin:10px 0;
 border:1px solid #ffd0d0;
 border-radius:11px;
 background:linear-gradient(135deg,#fff8f8,#fff);
}

.watch-control-item{min-width:0}

.watch-control-item b{
 display:block;
 font-size:23px;
 line-height:1;
 font-weight:950;
 color:#FF0000;
}

.watch-control-item small{
 display:block;
 margin-top:5px;
 font-size:8px;
 line-height:1.1;
 font-weight:800;
 color:#777;
}

.watch-total{text-align:right}
.watch-total b{color:#FF0000}

.autoplay-control{
 display:flex;
 align-items:center;
 justify-content:center;
 gap:8px;
 min-width:0;
}

.autoplay-control > span{
 font-size:14px;
 color:#333;
 white-space:nowrap;
}

.autoplay-toggle{
 position:relative;
 width:54px;
 height:32px;
 flex:0 0 54px;
 padding:0;
 border:0;
 border-radius:999px;
 background:#d7d7d7;
 cursor:pointer;
 transition:background .18s ease;
}

.autoplay-toggle span{
 position:absolute;
 top:4px;
 left:4px;
 width:24px;
 height:24px;
 border-radius:50%;
 background:#fff;
 box-shadow:0 1px 4px rgba(0,0,0,.25);
 transition:transform .18s ease;
}

.autoplay-toggle.on{background:#FF0000}
.autoplay-toggle.on span{transform:translateX(20px)}

.actions-row{
  display:grid;
  grid-template-columns:1fr;
  gap:8px;
  margin:10px 0;
}

.actions-row .primary{
  width:100%;
  min-height:56px;
  border:0;
  border-radius:8px;
  background:#FF0000;
  color:#fff;
  font-size:18px;
  font-weight:950;
  cursor:pointer;
}

.video-list{
  display:grid;
  gap:7px;
  width:100%;
}

.video-list-item{
  width:100%;
  min-height:66px;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  gap:10px;
  padding:7px;
  border:1px solid #d7d7d7;
  border-radius:5px;
  background:#fff;
  color:#222;
  text-align:left;
  cursor:pointer;
}

.video-list-item > div:last-child{
  min-width:0;
}

.video-list-item b{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:13px;
}

.video-list-item span{
  display:block;
  margin-top:3px;
  color:#777;
  font-size:10px;
}

.thumb{
  width:78px;
  height:48px;
  background:#222;
  color:#fff;
  border-radius:5px;
  display:grid;
  place-items:center;
  flex:0 0 78px;
}

.watch-reward-card{
  width:100%;
  box-sizing:border-box;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:12px;
  margin:12px 0;
  border-radius:11px;
  background:linear-gradient(135deg,#fff8f8,#fff);
  border:1px solid #ffd1d1;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}

.reward-main{
  display:flex;
  align-items:center;
  gap:9px;
  min-width:0;
}

.watch-milestone-card{
  margin-top:10px;
  padding:13px 15px;
  border:1px solid #ffd2d2;
  border-radius:12px;
  background:#fffafa;
}

.milestone-card-head{
  display:flex;
  align-items:center;
  gap:9px;
}

.milestone-icon{
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border-radius:10px;
  background:#fff0bf;
  font-size:18px;
  flex:0 0 36px;
}

.milestone-card-head>div:nth-child(2){
  min-width:0;
  flex:1;
}

.milestone-card-head strong{
  display:block;
  color:#e63232;
  font-size:15px;
  font-weight:950;
}

.milestone-card-head span{
  display:block;
  margin-top:2px;
  color:#777;
  font-size:9px;
}

.milestone-count{
  min-width:32px;
  padding:6px 7px;
  border-radius:8px;
  background:#fff0f0;
  color:#e63232;
  text-align:center;
  font-size:12px;
}

.milestone-mini-row{
  display:grid;
  grid-template-columns:90px 1fr auto;
  align-items:center;
  gap:9px;
  margin-top:10px;
}

.milestone-mini-row>div:first-child b,
.milestone-mini-row>div:first-child span{
  display:block;
}

.milestone-mini-row>div:first-child b{
  font-size:10px;
}

.milestone-mini-row>div:first-child span{
  margin-top:2px;
  color:#888;
  font-size:8px;
}

.milestone-mini-progress>div{
  height:6px;
  background:#eee;
  border-radius:99px;
  overflow:hidden;
}

.milestone-mini-progress i{
  display:block;
  height:100%;
  background:#ed3434;
  border-radius:99px;
}

.milestone-mini-progress small{
  display:block;
  margin-top:3px;
  text-align:right;
  color:#888;
  font-size:7px;
}

.milestone-mini-row>strong{
  min-width:38px;
  color:#159447;
  text-align:right;
  font-size:12px;
}

.milestone-complete-state{padding:14px;border-radius:10px;background:#eafff1;color:#098b46;font-size:11px;font-weight:900;text-align:center;margin-top:10px}.milestone-card-note{
  margin:9px 0 0;
  color:#777;
  font-size:8px;
  line-height:1.4;
}

@media(max-width:480px){
  .milestone-mini-row{grid-template-columns:80px 1fr auto;gap:7px}
}

.reward-icon{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border-radius:10px;
  background:#fff0bf;
  font-size:19px;
  flex:0 0 38px;
}

.reward-main strong{
  display:block;
  color:#e63232;
  font-size:16px;
  font-weight:950;
}

.reward-main span{
  display:block;
  margin-top:3px;
  color:#777;
  font-size:9px;
}

.reward-values{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:12px;
  flex:none;
}

.reward-coins,
.reward-dollar{
  text-align:right;
  flex:none;
}

.reward-coins strong{
  display:block;
  color:#e3a500;
  font-size:17px;
  font-weight:950;
}

.reward-dollar strong{
  display:block;
  color:#159447;
  font-size:17px;
  font-weight:950;
}

.reward-coins span,
.reward-dollar span{
  display:block;
  margin-top:2px;
  color:#999;
  font-size:8px;
  font-weight:800;
  white-space:nowrap;
}

.reward-divider{
  width:1px;
  height:28px;
  background:#e5e5e5;
}

/* Popup ad: overlay only; it never occupies normal page flow. */
.video-ad-overlay{
  position:fixed !important;
  inset:0 !important;
  z-index:2147483000 !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  padding:16px !important;
  box-sizing:border-box !important;
  background:rgba(0,0,0,.62) !important;
}

.video-ad-modal{
  position:relative !important;
  z-index:2147483001 !important;
  width:min(420px,calc(100vw - 32px)) !important;
  max-width:420px !important;
  max-height:calc(100vh - 32px) !important;
  overflow:auto !important;
  box-sizing:border-box !important;
  border-radius:12px !important;
  background:#fff !important;
  box-shadow:0 18px 60px rgba(0,0,0,.35) !important;
}

.video-ad-modal > *{
  max-width:100% !important;
  box-sizing:border-box !important;
}

.video-ad-modal iframe{
  max-width:100% !important;
}

.asetra-banner-wrap{
  width:100%;
  margin:10px 0;
  border:1px solid #e2e2e2;
  border-radius:10px;
  overflow:hidden;
  background:#fff;
  box-sizing:border-box;
}
.asetra-banner-label{
  height:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:8px;
  font-weight:800;
  letter-spacing:.5px;
  color:#999;
  background:#fafafa;
  border-bottom:1px solid #eee;
}
.asetra-banner-slot{
  width:100%;
  height:90px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#fff;
}
.asetra-banner-link{
  width:100%;
  height:100%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:4px;
  text-decoration:none;
}
.asetra-banner-link strong{
  font-size:22px;
  font-weight:900;
  color:#222;
}
.asetra-banner-link span{
  font-size:11px;
  color:#888;
}

@media (max-width:600px){
 .feed-tabs{margin-bottom:9px}.feed-tab{min-height:34px;font-size:10px;padding:0 8px}
 .content-head{margin-bottom:9px}.content-head h1{font-size:20px}.content-head p{font-size:10px}.status-pill{font-size:8px;padding:6px 8px}
 .watch-control-card{
   min-height:68px;
   padding:8px 9px;
   gap:5px;
 }

 .watch-control-item b{font-size:21px}
 .watch-control-item small{font-size:8px}

 .autoplay-control{gap:5px}
 .autoplay-control > span{font-size:12px}

 .autoplay-toggle{
   width:44px;
   height:25px;
   flex-basis:44px;
 }

 .autoplay-toggle span{
   width:19px;
   height:19px;
 }

 .autoplay-toggle.on span{transform:translateX(20px)}


  .watch-reward-card{
    padding:10px;
    gap:8px;
  }

  .reward-main strong{
    font-size:14px;
  }

  .reward-main span{
    font-size:8px;
  }

  .reward-values{
    gap:7px;
  }

  .reward-coins strong,
  .reward-dollar strong{
    font-size:14px;
  }

  .reward-coins span,
  .reward-dollar span{
    font-size:7px;
  }

  .reward-divider{
    height:25px;
  }

  .actions-row .primary{
    min-height:54px;
    font-size:17px;
  }

  .video-ad-overlay{
    padding:10px !important;
  }

  .video-ad-modal{
    width:min(420px,calc(100vw - 20px)) !important;
    max-height:calc(100vh - 20px) !important;
  }
}

@media (max-width:390px){
  .watch-reward-card{
    align-items:flex-start;
  }

  .reward-icon{
    width:34px;
    height:34px;
    flex-basis:34px;
    font-size:17px;
  }

  .reward-main strong{
    font-size:13px;
  }

  .reward-values{
    gap:5px;
  }

  .reward-coins strong,
  .reward-dollar strong{
    font-size:13px;
  }
}

@media (min-width:901px){
  .player-card,
  .live-card{
    max-width:900px;
    margin-left:auto;
    margin-right:auto;
  }
}


.highrevenue-banner-wrap{
  width:100%;
  max-width:728px;
  margin:10px auto 14px;
  padding:0;
  border:1px solid #e3e3e3;
  border-radius:8px;
  overflow:hidden;
  background:#fff;
  box-sizing:border-box;
}
.highrevenue-banner-label{
  width:100%;
  height:17px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:8px;
  line-height:1;
  font-weight:800;
  letter-spacing:.5px;
  color:#8b8b8b;
  background:#fafafa;
  border-bottom:1px solid #ededed;
  box-sizing:border-box;
}
.highrevenue-banner-slot{
  width:100%;
  overflow:hidden;
  background:#fff;
  box-sizing:border-box;
}
.highrevenue-banner-slot iframe{
  display:block;
  width:100%;
  max-width:100%;
  border:0;
  margin:0;
  padding:0;
  box-sizing:border-box;
}
@media (max-width:600px){
  .highrevenue-banner-wrap{
    width:100%;
    max-width:100%;
    margin:8px 0 12px;
    border-radius:7px;
  }
  .highrevenue-banner-label{
    height:15px;
    font-size:7px;
  }
  .highrevenue-banner-slot,
  .highrevenue-banner-slot iframe{
    width:100%;
    max-width:100%;
    height:45px;
  }
}

/* Minimal YouTube overlay: keep only creator title/avatar and fullscreen/zoom. */
.yt-minimal-ui .yt-inner iframe{pointer-events:auto !important}
.yt-minimal-overlay{position:absolute;inset:0;z-index:8;display:flex;align-items:flex-start;justify-content:space-between;padding:12px 12px 0;box-sizing:border-box;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.46),transparent 28%)}
.yt-minimal-title{display:flex;align-items:center;gap:9px;min-width:0;max-width:calc(100% - 58px);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.55)}
.yt-minimal-avatar{width:36px;height:36px;flex:0 0 36px;border-radius:50%;overflow:hidden;border:1px solid rgba(255,255,255,.9);background:#202020;display:grid;place-items:center;font-size:14px;font-weight:900}
.yt-minimal-avatar img{width:100%;height:100%;object-fit:cover;display:block}
.yt-minimal-copy{min-width:0;display:flex;flex-direction:column;line-height:1.1}
.yt-minimal-copy strong{font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yt-minimal-copy span{font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.9)}
.yt-minimal-zoom{pointer-events:auto;width:40px;height:40px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.48);color:#fff;cursor:pointer;padding:0}
.yt-minimal-zoom:active{transform:scale(.95)}
.player-meta .duration{display:none !important}
@media(max-width:480px){.yt-minimal-overlay{padding:10px 10px 0}.yt-minimal-avatar{width:34px;height:34px;flex-basis:34px}.yt-minimal-copy strong{font-size:13px}.yt-minimal-copy span{font-size:10px}.yt-minimal-zoom{width:38px;height:38px}}

/* Shared milestone card — VIDEO / SHORTS / LIVE use the same layout. */
.watch-reward-card{
  width:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:space-between;
  gap:12px; padding:12px; margin:12px 0; border-radius:11px;
  background:linear-gradient(135deg,#fff8f8,#fff); border:1px solid #ffd1d1;
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.reward-main{display:flex; align-items:center; gap:9px; min-width:0}
.reward-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#fff0bf;font-size:19px;flex:0 0 38px}
.reward-main strong{display:block;color:#e63232;font-size:16px;font-weight:950}
.reward-main span{display:block;margin-top:3px;color:#777;font-size:9px}
.reward-values{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none}
.reward-dollar{text-align:right;flex:none}
.reward-dollar strong{display:block;color:#159447;font-size:17px;font-weight:950}
.reward-dollar span{display:block;margin-top:2px;color:#999;font-size:8px;font-weight:800;white-space:nowrap}
.reward-divider{width:1px;height:28px;background:#e5e5e5}
@media(max-width:560px){
  .watch-reward-card{gap:8px;padding:10px}
  .reward-main{gap:7px}
  .reward-icon{width:34px;height:34px;flex-basis:34px;font-size:17px}
  .reward-main strong{font-size:14px}
  .reward-main span{font-size:8px}
  .reward-values{gap:8px}
  .reward-dollar strong{font-size:14px}
  .reward-dollar span{font-size:7px}
  .reward-divider{height:24px}
}

/* FINAL MILESTONE UI — same as VIDEO reference across VIDEO / SHORTS / LIVE */
.watch-reward-card{
  display:block !important;
  width:100%; box-sizing:border-box; margin:12px 0; padding:14px 16px;
  border:1px solid #ffd1d1; border-radius:12px; background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.04); color:#222;
}
.watch-reward-head{display:flex;align-items:center;gap:9px;min-width:0}
.watch-reward-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:10px;background:#fff0bf;font-size:19px}
.watch-reward-title{min-width:0;flex:1}
.watch-reward-title strong{display:block;color:#e63232;font-size:16px;font-weight:950;line-height:1.15}
.watch-reward-title span{display:block;margin-top:3px;color:#777;font-size:9px;line-height:1.25}
.watch-reward-count{min-width:32px;padding:7px 8px;border-radius:8px;background:#fff1f1;color:#111;text-align:center;font-size:12px;font-weight:900}
.watch-reward-progress-row{display:grid;grid-template-columns:115px 1fr auto;align-items:center;gap:9px;margin-top:10px}
.watch-reward-label b,.watch-reward-label span{display:block}
.watch-reward-label b{font-size:10px;font-weight:900}
.watch-reward-label span{margin-top:2px;color:#888;font-size:8px}
.watch-reward-progress>div{height:7px;background:#eee;border-radius:99px;overflow:hidden}
.watch-reward-progress i{display:block;height:100%;background:#ed3434;border-radius:99px}
.watch-reward-progress small{display:block;margin-top:3px;text-align:right;color:#888;font-size:7px}
.watch-reward-progress-row>strong{min-width:40px;color:#159447;text-align:right;font-size:13px;font-weight:950}
.watch-reward-note{margin-top:9px;color:#777;font-size:8px;line-height:1.4}
.watch-reward-complete{margin-top:10px;padding:12px;border-radius:9px;background:#eafff1;color:#098b46;text-align:center;font-size:10px;font-weight:900}
@media(max-width:560px){
  .watch-reward-card{padding:12px}
  .watch-reward-progress-row{grid-template-columns:90px 1fr auto;gap:7px}
  .watch-reward-title strong{font-size:14px}
  .watch-reward-title span{font-size:8px}
  .watch-reward-icon{width:34px;height:34px;flex-basis:34px;font-size:17px}
}
`



