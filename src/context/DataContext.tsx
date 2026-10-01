import React,{createContext,useContext,useEffect,useMemo,useState} from "react";
import {dataProvider} from "@/services/dataProvider";
import type {ContentType} from "@/types";
const DataContext=createContext<any>(null);
function useHeadScript(id:string, enabled:boolean, setup:(s:HTMLScriptElement)=>void){
  useEffect(()=>{
    document.getElementById(id)?.remove();
    if(!enabled)return;
    const s=document.createElement("script"); s.id=id; s.async=true; setup(s); document.head.appendChild(s);
    return()=>{document.getElementById(id)?.remove()};
  },[id,enabled,setup]);
}
export function DataProvider({children,user}:{children:React.ReactNode; user:any}){
  const [db,setDb]=useState(()=>dataProvider.getDB());
  const [loading,setLoading]=useState(true);

  const refresh=async()=>{
    try{
      setDb(await dataProvider.loadDB());
    }catch(e){
      console.error("Data load failed:",e);
      setDb(dataProvider.getDB());
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{void refresh()},[]);
  const s=db.settings;
  useHeadScript("engage-monetag-vignette",!!s.monetagVignetteEnabled,(x)=>{x.src="https://n6wxm.com/vignette.min.js";x.dataset.zone="11673586"});
  useHeadScript("engage-monetag-push-created",!!s.monetagPushCreatedEnabled,(x)=>{x.src="https://5gvci.com/act/files/tag.min.js?z=11673612";x.setAttribute("data-cfasync","false")});
  useHeadScript("engage-monetag-inpage-push",!!s.monetagInPagePushEnabled,(x)=>{x.src="https://nap5k.com/tag.min.js";x.dataset.zone="11673630"});
  useEffect(()=>{if(!user)return;dataProvider.ensureUser({id:user.id,email:user.email,name:user.name||user.email,role:user.role||"user",provider:"email"});refresh()},[user?.id]);
  const value=useMemo(()=>({db,loading,campaigns:db.campaigns,contents:db.contents,adminSettings:db.settings,milestones:db.milestones||[],wallet:user?db.wallets[user.id]:undefined,getWalletTransactions:(userId:string)=>dataProvider.getWalletTransactions(userId),requestWithdrawal:(input:any)=>dataProvider.requestWithdrawal(input),listContents:(type?:ContentType)=>dataProvider.listContents(type),createCampaign:async(input:any)=>{if(user?.role!=="admin" && user?.role!=="creator" && user?.accountType!=="promotion") throw new Error("Only creator/promotion accounts can create campaigns.");const creationRequestId=input.creationRequestId||crypto.randomUUID();const existing=db.campaigns.find((c:any)=>c.creationRequestId===creationRequestId);if(existing)return existing;const content=await dataProvider.addContent({type:input.type,title:input.title,creator:user?.name||user?.email||"Creator",creatorId:user?.id||"",youtubeUrl:input.youtubeUrl,youtubeVideoId:input.youtubeVideoId,durationSeconds:Number(input.durationSeconds||0),thumbnail:`https://img.youtube.com/vi/${input.youtubeVideoId}/hqdefault.jpg`});const campaign=await dataProvider.createCampaign({creatorId:user?.id||"",title:input.title,type:input.type,contentId:content.id,targetViews:Number(input.targetViews||0),watchSeconds:Number(input.watchSeconds||0),campaignCost:Number(input.campaignCost||0),creationRequestId});await refresh();return campaign},qualify:async(campaignId:string,userId:string)=>{await dataProvider.qualify(campaignId,userId);await refresh()},deleteCampaign:async(campaignId:string)=>{
      if(!user?.id) throw new Error("You must be signed in.");
      const result=await dataProvider.deleteCampaign(campaignId,user.id);
      await refresh();
      return result;
    },getWatchedContentIds:(userId:string)=>dataProvider.getWatchedContentIds(userId),markContentWatched:async(userId:string,contentId:string)=>dataProvider.markContentWatched(userId,contentId),updateMilestones:(milestones:any[])=>dataProvider.updateMilestones(milestones).then(()=>refresh()),refresh}),[db,user,loading]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export function useData(){const ctx=useContext(DataContext);if(!ctx)throw new Error("useData must be used inside DataProvider");return ctx}
