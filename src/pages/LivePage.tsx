import React,{useEffect,useLayoutEffect,useRef,useState} from "react";
import Layout from "@/components/Layout";
import YouTubePlayer,{PlayerState,YouTubePlayerHandle} from "@/components/YouTubePlayer";
import {dataProvider} from "@/services/dataProvider";
import {useAuth} from "@/context/AuthContext";
import {useData} from "@/context/DataContext";
import {Ban,CheckCircle2} from "lucide-react";

export default function LivePage(){
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "VIDEO_PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

 const {user}=useAuth();
 const data=useData();
 const playerRef=useRef<YouTubePlayerHandle>(null);
 const db=dataProvider.getDB();

 const [watchedIds,setWatchedIds]=useState<string[]>([]);
 const [state,setState]=useState<PlayerState>("UNKNOWN");
 const [watch,setWatch]=useState(0);
 const [viewers,setViewers]=useState(0);
 const [autoplay,setAutoplay]=useState(Boolean(db.settings?.autoplayEnabled ?? true));
 const [qualified,setQualified]=useState(false);
 const [hasStarted,setHasStarted]=useState(false);
 const [toast,setToast]=useState("");

 const last=useRef(0);

 useEffect(()=>{
   if(!user?.id) return;

   dataProvider.getWatchedContentIds(user.id)
     .then(setWatchedIds)
     .catch(console.error);
 },[user?.id]);

 const liveItems=db.contents.filter(c=>
   c.type==="live" &&
   c.creatorId!==user?.id &&
   !watchedIds.includes(c.id)
 );

 const live=liveItems[0];

 const campaign=live
   ? db.campaigns.find(c=>
       c.type==="live" &&
       c.status==="active" &&
       c.contentId===live.id
     ) || db.campaigns.find(c=>
       c.type==="live" &&
       c.status==="active" &&
       c.creatorId!==user?.id
     )
   : undefined;

 const target=campaign?.requiredWatchSeconds||60;
 const settings=db.settings;

 useEffect(()=>{
   if(!live) return;
   setViewers(live.views||0);
 },[live?.id]);

 useEffect(()=>{
   const t=setInterval(()=>
     setViewers(v=>
       Math.max(1,v+Math.floor(Math.random()*13)-6)
     ),2500
   );
   return()=>clearInterval(t);
 },[]);

 useEffect(()=>{
   setWatch(0);
   setQualified(false);
   setHasStarted(false);
   last.current=0;
 },[live?.id,campaign?.id,target]);

 function time(cur:number){
   if(state==="PLAYING"){
     if(last.current){
       const d=cur-last.current;
       if(d>0&&d<=1.2)
         setWatch(x=>Math.min(target,x+d));
     }

     last.current=cur;

   }else{
     last.current=cur;
   }
 }

 function sc(x:PlayerState){
   setState(x);
   if(x === "PLAYING") setHasStarted(true);

   if(x!=="PLAYING")
     last.current=0;

   if(x==="ENDED"&&live&&user){
     dataProvider.markContentWatched(user.id,live.id)
       .then(()=>setWatchedIds(ids=>
         ids.includes(live.id)?ids:[...ids,live.id]
       ))
       .catch(console.error);
   }
 }

 useEffect(()=>{
   if(
     watch>=target &&
     !qualified &&
     campaign &&
     live &&
     user
   ){
     setQualified(true);

     (async()=>{
       try{
         await dataProvider.qualify(
           campaign.id,
           user.id
         );

         await dataProvider.markContentWatched(
           user.id,
           live.id
         );

         setWatchedIds(ids=>
           ids.includes(live.id)
             ?ids
             :[...ids,live.id]
         );

         await data.refresh();

         setToast(
           `+${Math.round(Number(campaign.coinRewardPerUser||0)).toLocaleString()} coins and ₹${Number(campaign.dollarRewardPerUser||0).toFixed(4)} added to your wallet`
         );

         setTimeout(()=>setToast(""),4500);
       }catch(e){
         console.error(e);
         setQualified(false);
       }
     })();
   }
 },[
   watch,target,qualified,
   campaign?.id,live?.id,user?.id
 ]);

 if(!live){
   return <Layout>
     <div className="empty-content-card">
       <Ban size={34}/>
       <h2>No new live stream available</h2>
       <p>
         You have already watched the available live content,
         or your own live stream is hidden from you.
       </p>
     </div>
   </Layout>
 }

 return <Layout>
   {toast&&
     <div className="reward-toast">
       <CheckCircle2/>
       <div>
         <b>Reward Added!</b>
         <span>{toast}</span>
       </div>
     </div>
   }

   <div className="content-head">
     <div>
       <h1>Live</h1>
       <p>Current live sessions</p>
     </div>

     <div className={`live-status ${state==="PLAYING"?"on":""}`}>
       ● {state==="ENDED"?"OFFLINE":"LIVE NOW"}
     </div>
   </div>

   <div className="live-card">
     <div className="live-player">
       <YouTubePlayer
         ref={playerRef}
         key={live.id}
         videoId={live.youtubeVideoId}
         autoplay={autoplay}
         onStateChange={sc}
         onTime={time}
       />

       <span className="live-badge">● LIVE</span>
     </div>

     <div className="live-meta">
       <div>
         <b>{live.title}</b>
         <span>{live.creator}</span>
       </div>

       <div className="viewer-count">
         {viewers.toLocaleString()}
         <small>VIEWERS</small>
       </div>
     </div>
   </div>

   <div className="watch-progress-strip">
     <div className="watch-progress-track"><i style={{width:`${Math.min(100,watch/target*100)}%`}}/></div>
     <span>{Math.round(Math.min(100,watch/target*100))}% watched</span>
   </div>

   <div className="watch-control-card">
     <div className="watch-control-item watch-timer">
       <b>{Math.max(0, Math.ceil(target - watch))}s</b>
       <small>SECONDS LEFT</small>
     </div>

     <div className="autoplay-control">
       <span>Autoplay</span>
       <button
         type="button"
         className={`autoplay-toggle ${autoplay ? "on" : ""}`}
         aria-label={autoplay ? "Turn autoplay off" : "Turn autoplay on"}
         aria-pressed={autoplay}
         onClick={() => setAutoplay(x => !x)}
       >
         <span />
       </button>
     </div>

     <div className="watch-control-item watch-total">
       <b>₹{Number(data.wallet?.earnings || 0).toFixed(2)}</b>
       <small>TOTAL EARNED</small>
     </div>
   </div>

   {campaign&&
     <div className="watch-reward-card">
       <div className="reward-main">
         <div className="reward-icon">🪙</div>
         <div>
           <strong>Watch & Earn</strong>
           <span>Complete {target}s to qualify</span>
         </div>
       </div>

       <div className="reward-values">
         <div className="reward-coins">
           <strong>+{Math.round(Number(campaign.coinRewardPerUser||0)).toLocaleString()}</strong>
           <span>COINS</span>
         </div>

         <div className="reward-divider"/>

         <div className="reward-dollar">
           <strong>+₹{Number(campaign.dollarRewardPerUser||0).toFixed(2)}</strong>
           <span>INR REWARD</span>
         </div>
       </div>
     </div>
   }

   {qualified&&
     <div className="qualified">
       ✓ Live watch completed — reward credited
     </div>
   }

   <div className="actions-row">
     <button
       className="primary"
       type="button"
       disabled={qualified}
       onClick={() => playerRef.current?.playVideo()}
     >
       {qualified ? "LIVE COMPLETED" : hasStarted ? "CONTINUE LIVE" : "START LIVE"}
     </button>
   </div>

   <div className="item-note">
     Timer stops automatically on pause, buffering or stream end.
     Once this live session is watched, it will not be shown again
     to the same user.
   </div>

 </Layout>
}

/* ===== LIVEPAGE CSS =====
 * Reuses the exact Watch & Earn UI styling from VideoPage so video and live
 * reward/watch controls stay visually identical. Only live-specific layout
 * overrides are added below.
 */
const PAGE_CSS = String.raw`
/* Shared watch-stack order: controls first, reward, progress, note, action. */

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


/* Live-specific layout: keep the player responsive while reusing the exact
   VideoPage controls/reward/progress UI below it. */
.live-card{
  width:100%;
  box-sizing:border-box;
  border-radius:10px;
  overflow:hidden;
  background:#050505;
  box-shadow:0 3px 15px #0002;
}
.live-player{
  position:relative;
  width:100%;
  height:auto;
  aspect-ratio:16 / 9;
  min-height:0 !important;
  background:#000;
  overflow:hidden;
}
.live-player .yt-wrap,
.live-player .yt-inner,
.live-player .yt-inner > div,
.live-player .yt-inner iframe{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  min-width:100% !important;
  min-height:100% !important;
  max-width:none !important;
  max-height:none !important;
  border:0 !important;
}
.live-badge{
  position:absolute;
  top:10px;
  left:10px;
  background:#ff0000;
  color:#fff;
  font-size:10px;
  font-weight:900;
  padding:7px 9px;
  border-radius:5px;
  z-index:7;
}
.viewer-count{
  font-size:22px;
  font-weight:900;
  text-align:right;
}
.viewer-count small{display:block;color:#999;font-size:9px;}

@media (max-width:600px){
  .live-card{width:100%;max-width:100%;}
  .live-player{
    aspect-ratio:9/16;
    max-height:calc(100vh - 235px);
    min-height:260px !important;
  }
  .live-meta{min-height:64px;padding:11px 12px;}
  .viewer-count{font-size:20px;}
  .watch-control-card{margin-top:10px;}
  .watch-reward-card{margin-top:12px;}
  .watch-progress-strip{margin-top:9px;}
  .item-note{margin-top:10px;margin-bottom:18px;}
}
@media (min-width:901px){
  .live-card{max-width:900px;margin-left:auto;margin-right:auto;}
  .live-player{min-height:460px;}
}
`;
