export function getYouTubeVideoId(value:string){
 try{const u=new URL(value.trim()),h=u.hostname.replace("www.","");
 if(h==="youtu.be")return u.pathname.slice(1).split("/")[0]||null;
 if(h==="youtube.com"||h==="m.youtube.com"){
  if(u.pathname==="/watch")return u.searchParams.get("v");
  if(u.pathname.startsWith("/shorts/"))return u.pathname.split("/")[2]||null;
  if(u.pathname.startsWith("/live/"))return u.pathname.split("/")[2]||null;
  if(u.pathname.startsWith("/embed/"))return u.pathname.split("/")[2]||null;
 }}catch{} return null;
}
import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';

export type PlayerState='UNSTARTED'|'ENDED'|'PLAYING'|'PAUSED'|'BUFFERING'|'CUED'|'UNKNOWN';

export type YouTubePlayerHandle={
 pauseVideo:()=>void;
 playVideo:()=>void;
 isPlaying:()=>boolean;
};

interface Props{
 videoId:string;
 autoplay?:boolean;
 onStateChange?:(s:PlayerState)=>void;
 onTime?:(current:number,duration:number)=>void;
 onEnded?:()=>void;
 className?:string;
 minimalUi?:boolean;
 overlayTitle?:string;
 overlaySubtitle?:string;
 overlayAvatarUrl?:string|null;
 showZoom?:boolean;
}

declare global{
 interface Window{
  YT?:any;
  onYouTubeIframeAPIReady?:()=>void;
 }
}

let apiPromise:Promise<void>|null=null;

function loadApi(){
 if(apiPromise)return apiPromise;

 apiPromise=new Promise(resolve=>{
  if(window.YT?.Player){
   resolve();
   return;
  }

  const s=document.createElement('script');
  s.src='https://www.youtube.com/iframe_api';

  window.onYouTubeIframeAPIReady=()=>resolve();

  document.head.appendChild(s);
 });

 return apiPromise;
}

const YouTubePlayer=forwardRef<YouTubePlayerHandle,Props>(
 function YouTubePlayer(
  {
   videoId,
   autoplay=true,
   onStateChange,
   onTime,
   onEnded,
   className='',
   minimalUi=false,
   overlayTitle='',
   overlaySubtitle='',
   overlayAvatarUrl=null,
   showZoom=true
  },
  ref
 ){

  const container=useRef<HTMLDivElement>(null);
  const player=useRef<any>(null);

  const callbacks=useRef({
   onStateChange,
   onTime,
   onEnded
  });

  callbacks.current={
   onStateChange,
   onTime,
   onEnded
  };

  const[ready,setReady]=useState(false);

  useImperativeHandle(ref,()=>({
   pauseVideo(){
    try{
     player.current?.pauseVideo?.();
    }catch{}
   },

   playVideo(){
    try{
     player.current?.playVideo?.();
    }catch{}
   },

   isPlaying(){
    try{
     return player.current?.getPlayerState?.()===1;
    }catch{
     return false;
    }
   }
  }),[]);

  useEffect(()=>{
   let dead=false;

   loadApi().then(()=>{
    if(dead||!container.current)return;

    container.current.innerHTML='';

    const div=document.createElement('div');
    container.current.appendChild(div);

    player.current=new window.YT.Player(
     div,
     {
      videoId,

      playerVars:{
       autoplay:autoplay?1:0,
       controls:0,
       disablekb:1,
       fs:0,
       iv_load_policy:3,
       rel:0,
       modestbranding:1,
       playsinline:1
      },

      events:{
       onReady:(e:any)=>{
        setReady(true);

        const tick=()=>{
         if(!player.current)return;

         const current=Number(
          player.current.getCurrentTime?.()||0
         );

         const duration=Number(
          player.current.getDuration?.()||0
         );

         callbacks.current.onTime?.(
          current,
          duration
         );
        };

        (e.target as any).__engageTick=
          setInterval(tick,250);
      },

       onStateChange:(e:any)=>{
        const map:any={
         '-1':'UNSTARTED',
         0:'ENDED',
         1:'PLAYING',
         2:'PAUSED',
         3:'BUFFERING',
         5:'CUED'
        };

        const s=
          map[e.data]||'UNKNOWN';

        callbacks.current.onStateChange?.(s);

        if(e.data===0){
         callbacks.current.onEnded?.();
        }
       }
      }
     }
    );
   });

   return()=>{
    dead=true;

    try{
     const tick=
       player.current?.__engageTick;

     if(tick)clearInterval(tick);

     player.current?.destroy();
    }catch{}
   };
  },[videoId,autoplay,minimalUi]);

  return(
   <div className={`yt-wrap ${minimalUi?"yt-minimal-ui":""} ${className}`}>
    <div
     ref={container}
     className="yt-inner"
    />

    {!ready&&(
     <div className="yt-loading">
      Loading YouTube…
     </div>
    )}
   </div>
  );
});

export default YouTubePlayer;
