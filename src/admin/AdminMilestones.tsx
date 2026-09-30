import React from "react";
import { Plus, Save, Trash2, Trophy } from "lucide-react";
import { dataProvider } from "@/services/dataProvider";
import { useData } from "@/context/DataContext";
import type { MilestoneConfig } from "@/types";

export default function AdminMilestones(){
  const data=useData();
  const [rows,setRows]=React.useState<MilestoneConfig[]>([]);
  const [saved,setSaved]=React.useState(false);
  React.useEffect(()=>setRows((data.milestones||[]).map((m:MilestoneConfig)=>({...m}))),[data.milestones]);

  const add=()=>setRows(r=>[...r,{id:crypto.randomUUID(),views:50,rewardRupees:10,sortOrder:r.length,active:true}]);
  const update=(id:string,key:"views"|"rewardRupees",value:number)=>setRows(r=>r.map(m=>m.id===id?{...m,[key]:value}:m));
  const remove=(id:string)=>setRows(r=>r.filter(m=>m.id!==id));
  const save=async()=>{
    const seen=new Set<number>();
    const clean=rows.map((m,i)=>({id:/^[0-9a-f-]{36}$/i.test(String(m.id||''))?m.id:crypto.randomUUID(),views:Math.max(1,Math.floor(Number(m.views)||1)),rewardRupees:Math.max(0,Number(m.rewardRupees)||0),sortOrder:i,active:m.active!==false})).filter(m=>m.rewardRupees>0).sort((a,b)=>a.views-b.views).filter(m=>{if(seen.has(m.views)) return false; seen.add(m.views); return true;}).map((m,i)=>({...m,sortOrder:i}));
    await dataProvider.updateMilestones(clean);
    await data.refresh();
    setSaved(true); window.setTimeout(()=>setSaved(false),2500);
  };
  return <div className="admin-milestones-page">
    <div className="admin-head"><div><h1>Milestones</h1><p>Create unlimited user view milestones. Users see all milestones in Wallet and only the next incomplete one while watching.</p></div><button className="admin-primary-btn" type="button" onClick={add}><Plus size={16}/> ADD MILESTONE</button></div>
    <section className="milestone-admin-panel">
      <div className="milestone-admin-panel-head"><div><Trophy size={20}/><h2>User View Milestones</h2></div><span>{rows.length} MILESTONES</span></div>
      {rows.length===0?<div className="milestone-empty">No milestones configured. Add your first milestone.</div>:<div className="milestone-list">{rows.sort((a,b)=>a.views-b.views).map((m,i)=><div className="milestone-admin-row" key={m.id}><div className="milestone-number">{i+1}</div><label><span>QUALIFIED VIEWS</span><input type="number" min="1" value={m.views} onChange={e=>update(m.id,"views",Number(e.target.value))}/></label><label><span>REWARD (₹)</span><input type="number" min="0" step="0.01" value={m.rewardRupees} onChange={e=>update(m.id,"rewardRupees",Number(e.target.value))}/></label><div className="milestone-preview">₹{Number(m.rewardRupees||0).toFixed(2)} at {m.views} views</div><button type="button" className="milestone-delete" onClick={()=>remove(m.id)} aria-label="Delete milestone"><Trash2 size={17}/></button></div>)}</div>}
      <div className="milestone-admin-footer"><p>Milestones are cumulative across qualified views. A reward is paid once when the user reaches that threshold.</p><button className="admin-save-btn" type="button" onClick={save}><Save size={15}/>{saved?"SAVED":"SAVE MILESTONES"}</button></div>
    </section>
    <style>{CSS}</style>
  </div>
}

const CSS=`.admin-milestones-page{max-width:1100px;margin:0 auto}.admin-primary-btn,.admin-save-btn{border:0;border-radius:9px;background:#ed3434;color:#fff;font-weight:950;padding:11px 14px;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.milestone-admin-panel{margin-top:16px;background:#fff;border:1px solid #e7e7e7;border-radius:14px;padding:16px}.milestone-admin-panel-head{display:flex;justify-content:space-between;align-items:center}.milestone-admin-panel-head>div{display:flex;align-items:center;gap:8px}.milestone-admin-panel-head svg{color:#ed3434}.milestone-admin-panel-head h2{margin:0;font-size:17px}.milestone-admin-panel-head span{font-size:8px;font-weight:950;color:#ed3434;background:#fff0f0;padding:6px 8px;border-radius:99px}.milestone-list{display:grid;gap:9px;margin-top:13px}.milestone-admin-row{display:grid;grid-template-columns:34px 170px 150px 1fr 40px;gap:10px;align-items:end;padding:11px;border:1px solid #eee;border-radius:11px}.milestone-number{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#fff0f0;color:#ed3434;font-weight:950}.milestone-admin-row label span{display:block;font-size:7px;font-weight:950;color:#888;margin-bottom:4px}.milestone-admin-row input{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:7px;padding:9px;font-weight:800}.milestone-preview{font-size:10px;font-weight:900;color:#098b46;padding-bottom:9px}.milestone-delete{height:36px;border:1px solid #ffd0d0;background:#fff5f5;color:#d22;border-radius:8px;display:grid;place-items:center;cursor:pointer}.milestone-admin-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:13px;padding-top:12px;border-top:1px solid #eee}.milestone-admin-footer p{margin:0;color:#888;font-size:9px;line-height:1.45}.milestone-empty{padding:30px;text-align:center;color:#888;font-size:11px}.admin-save-btn{background:#111}@media(max-width:760px){.admin-head{flex-direction:column;gap:10px}.milestone-admin-row{grid-template-columns:30px 1fr 1fr 40px}.milestone-preview{grid-column:2/4}.milestone-admin-footer{flex-direction:column;align-items:stretch}}`;
