import Layout from "@/components/Layout";
import { NativePopup } from "@/components/NativeAd";
import YouTubePlayer, { PlayerState, YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { dataProvider } from "@/services/dataProvider";
import { Ban, CheckCircle2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

function HighRevenueShortBanner({enabled}:{enabled:boolean}){
  useEffect(()=>{
    const id="engage-highrevenue-short-banner";
    const slot=document.getElementById(id);
    if(!slot) return;

    slot.innerHTML="";
    if(!enabled) return;

    (window as any).atOptions={
      key:"5b244a28bde2dfe01f4224f1c7048748",
      format:"iframe",
      height:60,
      width:468,
      params:{}
    };

    const script=document.createElement("script");
    script.src="https://www.highrevenueformat.com/5b244a28bde2dfe01f4224f1c7048748/invoke.js";
    script.async=false;
    slot.appendChild(script);

    return()=>{slot.innerHTML="";};
  },[enabled]);

  if(!enabled) return null;

  return(
    <div className="short-banner-wrap" aria-label="Advertisement">
      <div className="short-banner-label">ADVERTISEMENT</div>
      <div id="engage-highrevenue-short-banner" className="short-banner-slot"/>
    </div>
  );
}

export default function ShortsPage(){
  React.useEffect(()=>{
    const style=document.createElement("style");
    style.setAttribute("data-engage-style","SHORTS_PAGE_CSS");
    style.textContent=PAGE_CSS;
    document.head.appendChild(style);
    return()=>style.remove();
  },[]);

  const {user}=useAuth();
  const data=useData();
  const playerRef=useRef<YouTubePlayerHandle>(null);
  const db=dataProvider.getDB();

  const [watchedIds,setWatchedIds]=useState<string[]>([]);
  const [i,setI]=useState(0);
  const [state,setState]=useState<PlayerState>("UNKNOWN");
  const [duration,setDuration]=useState(0);
  const [watched,setWatched]=useState(0);
  const [ad,setAd]=useState(false);
  const [qualified,setQualified]=useState(false);
  const [autoplay,setAutoplay]=useState(true);
  const [hasStarted,setHasStarted]=useState(false);
  const [toast,setToast]=useState("");

  const last=useRef(0);
  const intervalAdShown=useRef(false);
  const endAdShown=useRef(false);
  const qualificationPending=useRef(false);

  useEffect(()=>{
    if(!user?.id) return;
    dataProvider.getWatchedContentIds(user.id)
      .then(setWatchedIds)
      .catch(console.error);
  },[user?.id]);

  const shorts=db.contents.filter(c=>
    c.type==="shorts" &&
    c.creatorId!==user?.id &&
    !watchedIds.includes(c.id)
  );

  useEffect(()=>{
    if(i>=shorts.length) setI(0);
  },[shorts.length,i]);

  const s=shorts[i]||shorts[0];

  const campaign=s
    ? db.campaigns.find(c=>
        c.type==="shorts" &&
        c.status==="active" &&
        c.contentId===s.id
      ) || db.campaigns.find(c=>
        c.type==="shorts" &&
        c.status==="active" &&
        c.creatorId!==user?.id
      )
    : undefined;

  const target=campaign?.requiredWatchSeconds||30;
  const settings=db.settings;

  useEffect(()=>{
    setWatched(0);
    setDuration(0);
    setQualified(false);
    setHasStarted(false);
    setAd(false);
    last.current=0;
    intervalAdShown.current=false;
    endAdShown.current=false;
    qualificationPending.current=false;
  },[s?.id,campaign?.id,target]);

  function onTime(cur:number,dur:number){
    setDuration(dur);

    if(state==="PLAYING"){
      if(last.current>0){
        const delta=cur-last.current;
        if(delta>0&&delta<=1.2){
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

  function stateChange(x:PlayerState){
    setState(x);

    if(x==="PLAYING"){
      setHasStarted(true);
      last.current=0;
    }

    if(x!=="PLAYING"){
      last.current=0;
    }

    if(x==="ENDED"&&s&&user&&!campaign){
      dataProvider.markContentWatched(user.id,s.id)
        .then(()=>setWatchedIds(ids=>
          ids.includes(s.id)?ids:[...ids,s.id]
        ))
        .catch(console.error);
    }
  }

  async function completeCampaign(){
    if(!campaign||!user||!s||qualified) return;

    try{
      await dataProvider.qualify(campaign.id,user.id);
      await dataProvider.markContentWatched(user.id,s.id);

      setWatchedIds(ids=>
        ids.includes(s.id)?ids:[...ids,s.id]
      );

      await data.refresh();
      setQualified(true);

      const coins=Number(campaign.coinRewardPerUser||0);
      const dollars=Number(campaign.dollarRewardPerUser||0);

      setToast(
        `+${Math.round(coins).toLocaleString()} coins and ₹${dollars.toFixed(2)} added to your wallet`
      );

      window.setTimeout(()=>setToast(""),4500);
    }catch(e){
      console.error(e);
      setQualified(false);
    }finally{
      qualificationPending.current=false;
    }
  }

  useEffect(()=>{
    if(
      watched>=target &&
      !qualified &&
      !qualificationPending.current &&
      campaign &&
      user &&
      s
    ){
      qualificationPending.current=true;

      if(
        settings.adEnabled &&
        settings.profitablerSquareEnabled &&
        settings.showAdOnEnd &&
        !endAdShown.current
      ){
        endAdShown.current=true;
        playerRef.current?.pauseVideo();
        setAd(true);
      }else{
        void completeCampaign();
      }
    }
  },[
    watched,target,qualified,
    campaign?.id,user?.id,s?.id,
    settings.adEnabled,
    settings.profitablerSquareEnabled,
    settings.showAdOnEnd
  ]);


  function next(){
    if(!shorts.length) return;
    setI(x=>(x+1)%shorts.length);
    if(autoplay){
      window.setTimeout(()=>playerRef.current?.playVideo(),500);
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

  if(!s){
    return(
      <Layout>
        <div className="empty-content-card">
          <Ban size={34}/>
          <h2>No new Shorts available</h2>
          <p>
            You have already watched the available Shorts,
            or there are no eligible Shorts for your account.
          </p>
        </div>
      </Layout>
    );
  }

  const valid=duration===0||duration<60;
  const progress=target?Math.min(100,watched/target*100):0;
  const remaining=Math.max(0,Math.ceil(target-watched));

  return(
    <Layout>
      {toast&&(
        <div className="reward-toast">
          <CheckCircle2/>
          <div>
            <b>Reward Added!</b>
            <span>{toast}</span>
          </div>
        </div>
      )}

      <div className="content-head">
        <div>
          <h1>Shorts</h1>
          <p>YouTube Shorts • under 60 seconds only</p>
        </div>
        <div className="status-pill">
          {state==="PLAYING"?"● PLAYING":"● "+state}
        </div>
      </div>

      <div className="short-stage">
        <div className="short-player">
          <YouTubePlayer
            ref={playerRef}
            key={s.id}
            videoId={s.youtubeVideoId}
            autoplay={false}
            onStateChange={stateChange}
            onTime={onTime}
          />
        </div>
      </div>

      <div className="short-info">
        <div>
          <b>{s.title}</b>
          <span>{s.creator}</span>
        </div>
        <div className="short-duration-hidden" aria-hidden="true" />
      </div>

      <div className="short-progress">
        <div className="short-progress-track">
          <i style={{width:`${progress}%`}}/>
        </div>
        <span>{Math.ceil(watched)}s / {target}s</span>
      </div>

      <div className="short-watch-controls">
        <div className="short-control-item short-timer">
          <b>{remaining}s</b>
          <small>SECONDS LEFT</small>
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

        <div className="short-control-item short-total">
          <b>₹{Number(data.wallet?.earnings||0).toFixed(2)}</b>
          <small>TOTAL EARNED</small>
        </div>
      </div>

      {campaign&&(
        <div className="short-reward-card">
          <div className="short-reward-main">
            <div className="short-reward-icon">🪙</div>
            <div>
              <strong>Watch & Earn</strong>
              <span>Complete {target}s to qualify</span>
            </div>
          </div>

          <div className="short-reward-values">
            <div className="short-reward-coins">
              <strong>
                +{Math.round(
                  Number(campaign.coinRewardPerUser||0)
                ).toLocaleString()}
              </strong>
              <span>COINS</span>
            </div>

            <div className="short-reward-divider"/>

            <div className="short-reward-dollar">
              <strong>
                +₹{Number(
                  campaign.dollarRewardPerUser||0
                ).toFixed(2)}
              </strong>
              <span>INR REWARD</span>
            </div>
          </div>
        </div>
      )}

      {!valid&&(
        <div className="error-inline">
          This content is 60 seconds or longer and is not eligible as a Short.
        </div>
      )}

      {qualified&&(
        <div className="qualified">
          ✓ Short completed — reward credited
        </div>
      )}

      <div className="short-actions">
        {!hasStarted?(
          <button
            className="primary wide"
            onClick={()=>playerRef.current?.playVideo()}
          >
            START
          </button>
        ):(
          <button
            className="primary wide"
            onClick={next}
          >
            NEXT SHORT
          </button>
        )}
      </div>

      <div className="item-note short-item-note">
        Timer stops automatically on pause, buffering or video end.
        Once this video is watched, it will not be shown again to the same user.
      </div>

      <HighRevenueShortBanner
        enabled={Boolean(settings.highRevenueBannerEnabled)}
      />

      {ad&&(
        <div className="video-ad-overlay" role="dialog" aria-modal="true">
          <div className="video-ad-modal">
            <NativePopup onClose={closeAd}/>
          </div>
        </div>
      )}
    </Layout>
  );
}

function format(s:number){
  const m=Math.floor(s/60);
  const sec=Math.floor(s%60);
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

const PAGE_CSS=String.raw`
.short-stage{
  width:100%;
  display:flex;
  justify-content:center;
  background:#050505;
  border-radius:10px;
  overflow:hidden;
  box-sizing:border-box;
}

.short-player{
  position:relative;
  width:min(100%,430px);
  aspect-ratio:9/16;
  max-height:680px;
  background:#000;
  overflow:hidden;
}

.short-player .yt-wrap,
.short-player .yt-inner,
.short-player .yt-inner>div,
.short-player .yt-inner iframe{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-width:100%!important;
  min-height:100%!important;
  max-width:none!important;
  max-height:none!important;
  border:0!important;
  overflow:hidden!important;
}

.short-info{
  width:100%;
  min-height:58px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 12px;
  box-sizing:border-box;
  background:#111;
  color:#fff;
}

.short-info>div:first-child{
  min-width:0;
  flex:1;
}

.short-info b{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:14px;
}

.short-info span{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  margin-top:4px;
  color:#999;
  font-size:11px;
}

.duration-ok,
.duration-bad{
  flex:none;
  font-weight:900;
}

.duration-ok{color:#fff}
.duration-bad{color:#FF0000}

.short-watch-controls{
  width:100%;
  min-height:64px;
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  align-items:center;
  gap:6px;
  padding:8px 10px;
  margin:10px 0;
  box-sizing:border-box;
  border:1px solid #ffd0d0;
  border-radius:10px;
  background:linear-gradient(135deg,#fff8f8,#fff);
}

.short-control-item{min-width:0}

.short-control-item b{
  display:block;
  line-height:1;
  font-size:18px;
  font-weight:950;
  color:#FF0000;
}

.short-control-item small{
  display:block;
  margin-top:4px;
  font-size:7px;
  line-height:1;
  font-weight:800;
  color:#777;
}

.short-total{text-align:right}

.short-autoplay-control{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:5px;
  min-width:0;
}

.short-autoplay-control>span{
  font-size:11px;
  color:#333;
  white-space:nowrap;
}

.short-autoplay-toggle{
  position:relative;
  width:42px;
  height:24px;
  flex:0 0 42px;
  padding:0;
  border:0;
  border-radius:999px;
  background:#d7d7d7;
  cursor:pointer;
  transition:background .18s ease;
}

.short-autoplay-toggle span{
  position:absolute;
  top:3px;
  left:3px;
  width:18px;
  height:18px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 1px 4px rgba(0,0,0,.25);
  transition:transform .18s ease;
}

.short-autoplay-toggle.on{background:#FF0000}
.short-autoplay-toggle.on span{transform:translateX(18px)}

.short-reward-card{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px;
  margin:10px 0;
  box-sizing:border-box;
  border:1px solid #ffd1d1;
  border-radius:10px;
  background:linear-gradient(135deg,#fff8f8,#fff);
}

.short-reward-main{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}

.short-reward-icon{
  width:34px;
  height:34px;
  flex:0 0 34px;
  display:grid;
  place-items:center;
  border-radius:9px;
  background:#fff0bf;
  font-size:17px;
}

.short-reward-main strong{
  display:block;
  color:#e63232;
  font-size:14px;
  font-weight:950;
}

.short-reward-main span{
  display:block;
  margin-top:2px;
  color:#777;
  font-size:8px;
}

.short-reward-values{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:8px;
  flex:none;
}

.short-reward-coins,
.short-reward-dollar{text-align:right}

.short-reward-coins strong,
.short-reward-dollar strong{
  display:block;
  font-size:14px;
  font-weight:950;
}

.short-reward-coins strong{color:#e3a500}
.short-reward-dollar strong{color:#159447}

.short-reward-coins span,
.short-reward-dollar span{
  display:block;
  margin-top:2px;
  color:#999;
  font-size:7px;
  font-weight:800;
  white-space:nowrap;
}

.short-reward-divider{
  width:1px;
  height:24px;
  background:#e5e5e5;
}

.short-progress{
  width:100%;
  display:flex;
  align-items:center;
  gap:8px;
  margin:8px 0;
}

.short-progress-track{
  position:relative;
  height:5px;
  flex:1;
  overflow:hidden;
  border-radius:999px;
  background:#e9e9e9;
}

.short-progress-track i{
  display:block;
  height:100%;
  border-radius:999px;
  background:#FF0000;
  transition:width .15s linear;
}

.short-progress>span{
  flex:none;
  color:#777;
  font-size:9px;
  font-weight:800;
}

.short-actions{
  width:100%;
  margin:10px 0;
}

.short-actions .primary{
  width:100%;
  min-height:52px;
  border:0;
  border-radius:8px;
  background:#FF0000;
  color:#fff;
  font-size:17px;
  font-weight:950;
  cursor:pointer;
}

.video-ad-overlay{
  position:fixed!important;
  inset:0!important;
  z-index:2147483000!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:10px!important;
  box-sizing:border-box!important;
  background:rgba(0,0,0,.62)!important;
}

.video-ad-modal{
  position:relative!important;
  width:min(420px,calc(100vw - 20px))!important;
  max-width:420px!important;
  max-height:calc(100vh - 20px)!important;
  overflow:auto!important;
  box-sizing:border-box!important;
  border-radius:12px!important;
  background:#fff!important;
  box-shadow:0 18px 60px rgba(0,0,0,.35)!important;
}

.video-ad-modal>*{
  max-width:100%!important;
  box-sizing:border-box!important;
}

.video-ad-modal iframe{max-width:100%!important}

.short-banner-wrap{
  width:100%;
  max-width:468px;
  margin:10px auto 14px;
  border:1px solid #e3e3e3;
  border-radius:7px;
  overflow:hidden;
  background:#fff;
  box-sizing:border-box;
}

.short-banner-label{
  height:15px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:7px;
  line-height:1;
  font-weight:800;
  letter-spacing:.5px;
  color:#8b8b8b;
  background:#fafafa;
  border-bottom:1px solid #ededed;
}

.short-banner-slot{
  width:100%;
  height:60px!important;
  min-height:60px!important;
  overflow:hidden;
  background:#fff;
}

.short-banner-slot iframe{
  display:block;
  width:468px;
  max-width:100%;
  height:60px!important;
  border:0;
  margin:0 auto;
  padding:0;
  box-sizing:border-box;
}

@media(max-width:600px){
  .content-head h1{font-size:24px}
  .content-head p{font-size:12px}
  .status-pill{font-size:10px;padding:7px 10px}
  .short-stage{border-radius:8px}
  .short-info b{font-size:16px}
  .short-info span{font-size:12px}

  .short-player{
    width:100%;
    max-width:430px;
    aspect-ratio:4/5;
    max-height:64vh;
  }

  .short-watch-controls{
    min-height:60px;
    padding:7px 8px;
    gap:4px;
  }

  .short-control-item b{font-size:21px}
  .short-control-item small{font-size:8px}
  .short-autoplay-control>span{font-size:12px}

  .short-autoplay-toggle{
    width:38px;
    height:22px;
    flex-basis:38px;
  }

  .short-autoplay-toggle span{
    width:16px;
    height:16px;
    top:3px;
    left:3px;
  }

  .short-autoplay-toggle.on span{transform:translateX(16px)}

  .short-reward-card{
    gap:7px;
    padding:9px;
  }

  .short-reward-main strong{font-size:14px}
  .short-reward-main span{font-size:8px}
  .short-reward-values{gap:6px}

  .short-reward-coins strong,
  .short-reward-dollar strong{font-size:14px}

  .short-reward-coins span,
  .short-reward-dollar span{font-size:6px}

  .short-banner-wrap{
    width:100%;
    max-width:100%;
    margin:8px 0 12px;
  }

  .short-banner-slot,
  .short-banner-slot iframe{
    width:100%;
    max-width:100%;
    height:60px!important;
  }
}

@media(min-width:901px){
  .short-stage{
    max-width:470px;
    margin-left:auto;
    margin-right:auto;
  }
}
`;
