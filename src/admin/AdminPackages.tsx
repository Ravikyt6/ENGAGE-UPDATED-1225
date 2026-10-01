import React, { useState } from "react";
import { Check, Edit3, Eye, EyeOff, Package, Save, X } from "lucide-react";
import { useData } from "@/context/DataContext";
import { getRequiredWatchSeconds, formatWatchTime } from "@/services/campaignPackages";
import type { CampaignPackage } from "@/types";

export default function AdminPackages() {
  const { db, updateCampaignPackage } = useData();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const packages = [...(db.packages || [])].sort((a: CampaignPackage,b: CampaignPackage)=>a.sortOrder-b.sortOrder);
  const startEdit = (p: CampaignPackage) => { setEditing(p.id); setDraft({name:p.name,priceRupees:p.priceRupees,targetViews:p.targetViews,totalWatchMinutes:p.totalWatchMinutes,active:p.active}); setMessage(""); };
  const save = async () => {
    if (!editing) return;
    const price = Number(draft.priceRupees), views = Number(draft.targetViews), mins = Number(draft.totalWatchMinutes);
    if (!draft.name?.trim() || price <= 0 || views <= 0 || mins <= 0) { setMessage("Enter valid package name, price, views and watch time."); return; }
    setSaving(true); setMessage("");
    try { await updateCampaignPackage(editing,{name:draft.name.trim(),priceRupees:price,targetViews:views,totalWatchMinutes:mins,active:draft.active}); setEditing(null); setMessage("Package updated successfully."); }
    catch(e:any){ setMessage(e?.message || "Could not update package."); }
    finally { setSaving(false); }
  };

  return <div className="admin-packages-page">
    <div className="admin-head"><div><h1>Campaign Packages</h1><p>Admin controls the exact package shown to creators. Creators cannot manually change views or watch time.</p></div></div>
    <div className="package-admin-banner"><Package size={22}/><div><b>PACKAGE CONTROL</b><span>Price, target views and total watch time are fetched from here when a creator selects a package.</span></div></div>
    {message && <div className="package-admin-message">{message}</div>}
    <div className="admin-package-grid">
      {packages.map((p:CampaignPackage)=>{
        const seconds=getRequiredWatchSeconds(p);
        const isEdit=editing===p.id;
        return <section className={`admin-package-card ${!p.active?'inactive':''}`} key={p.id}>
          <div className="admin-package-top"><div><small>PACKAGE</small><h2>{p.name}</h2></div><span className={`package-status ${p.active?'on':'off'}`}>{p.active?<><Eye size={13}/> ACTIVE</>:<><EyeOff size={13}/> HIDDEN</>}</span></div>
          {isEdit ? <div className="package-edit-form">
            <label>Package name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
            <label>Price (₹)<input type="number" min="1" value={draft.priceRupees} onChange={e=>setDraft({...draft,priceRupees:e.target.value})}/></label>
            <label>Target views<input type="number" min="1" value={draft.targetViews} onChange={e=>setDraft({...draft,targetViews:e.target.value})}/></label>
            <label>Total watch time (minutes)<input type="number" min="1" step="1" value={draft.totalWatchMinutes} onChange={e=>setDraft({...draft,totalWatchMinutes:e.target.value})}/></label>
            <label className="package-active-toggle"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Show to creators</label>
            <div className="package-edit-actions"><button onClick={()=>setEditing(null)}><X size={15}/> Cancel</button><button className="save" disabled={saving} onClick={save}>{saving?<Save size={15}/>:<Check size={15}/>} {saving?'Saving...':'Save Package'}</button></div>
          </div> : <>
            <div className="admin-package-price">₹{Number(p.priceRupees).toLocaleString()}</div>
            <div className="admin-package-stats"><div><b>{Number(p.targetViews).toLocaleString()}</b><span>Views</span></div><div><b>{formatWatchTime(seconds)}</b><span>Watch / user</span></div></div>
            <div className="admin-package-note">Creators select this package. The campaign stores the selected package values automatically.</div>
            <button className="admin-package-edit" onClick={()=>startEdit(p)}><Edit3 size={15}/> EDIT PACKAGE</button>
          </>}
        </section>;
      })}
    </div>
  </div>;
}

const style=document.createElement("style");
style.textContent=`
.admin-packages-page{max-width:1100px;margin:0 auto}.package-admin-banner{display:flex;gap:13px;align-items:center;padding:17px 18px;border:1px solid #eadcf8;background:#fbf7ff;border-radius:15px;margin:0 0 18px;color:#7c24d4}.package-admin-banner b,.package-admin-banner span{display:block}.package-admin-banner b{font-size:12px}.package-admin-banner span{margin-top:4px;color:#777;font-size:11px}.package-admin-message{padding:11px 14px;border-radius:10px;background:#eefbf2;color:#18733c;margin-bottom:15px;font-size:12px;font-weight:800}.admin-package-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.admin-package-card{background:#fff;border:1px solid #e7e2ea;border-radius:17px;padding:18px;box-shadow:0 5px 18px rgba(0,0,0,.03)}.admin-package-card.inactive{opacity:.65}.admin-package-top{display:flex;justify-content:space-between;align-items:flex-start}.admin-package-top small{font-size:8px;color:#999;font-weight:900;letter-spacing:.8px}.admin-package-top h2{margin:3px 0 0;font-size:22px}.package-status{display:flex;align-items:center;gap:4px;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900}.package-status.on{background:#eafff1;color:#118246}.package-status.off{background:#f2f2f2;color:#777}.admin-package-price{font-size:28px;font-weight:950;margin:15px 0}.admin-package-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.admin-package-stats div{background:#f8f8f8;border-radius:10px;padding:11px}.admin-package-stats b,.admin-package-stats span{display:block}.admin-package-stats b{font-size:15px}.admin-package-stats span{font-size:8px;color:#888;margin-top:3px}.admin-package-note{font-size:9px;color:#888;line-height:1.45;margin:13px 0}.admin-package-edit{width:100%;border:1px solid #ddd;background:#fff;border-radius:10px;height:38px;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.admin-package-edit:hover{border-color:#a72aff;color:#7c24d4}.package-edit-form{display:grid;gap:10px;margin-top:15px}.package-edit-form label{font-size:9px;font-weight:900;color:#555}.package-edit-form input[type=text],.package-edit-form input[type=number],.package-edit-form label>input:not([type=checkbox]){display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #ddd;border-radius:9px;padding:10px;background:#fff}.package-active-toggle{display:flex!important;align-items:center;gap:7px}.package-active-toggle input{width:auto!important;margin:0!important}.package-edit-actions{display:flex;gap:8px;margin-top:4px}.package-edit-actions button{flex:1;border:1px solid #ddd;background:#fff;border-radius:9px;height:38px;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:5px}.package-edit-actions .save{background:#171717;color:#fff;border-color:#171717}.package-edit-actions button:disabled{opacity:.6}@media(max-width:700px){.admin-package-grid{grid-template-columns:1fr}.admin-package-stats{grid-template-columns:1fr 1fr}}`;
document.head.appendChild(style);
