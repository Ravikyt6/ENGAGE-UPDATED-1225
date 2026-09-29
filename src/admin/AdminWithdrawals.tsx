import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, WalletCards, XCircle } from "lucide-react";
import { dataProvider } from "@/services/dataProvider";

const PAGE_SIZE = 25;
const statuses = ["", "pending", "processing", "completed", "rejected", "failed"];

const money = (v: any) => `₹${Number(v || 0).toFixed(4)}`;
const coins = (v: any) => Number(v || 0).toLocaleString();
const date = (v: any) => v ? new Intl.DateTimeFormat("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(v)) : "—";

export default function AdminWithdrawals() {
  const [summary, setSummary] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [reference, setReference] = useState<Record<string,string>>({});
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        dataProvider.adminListWithdrawals({ page, pageSize: PAGE_SIZE, status, search }),
        dataProvider.adminWithdrawalSummary(),
      ]);
      setRows(list.rows || []); setTotal(Number(list.total || 0)); setSummary(stats || {});
    } catch (e: any) { setMessage(e?.message || "Unable to load withdrawals."); }
    finally { setLoading(false); }
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  const update = async (row: any, next: string) => {
    setBusy(row.id); setMessage("");
    try {
      await dataProvider.adminUpdateWithdrawal(row.id, next, reference[row.id] || "");
      await load();
    } catch (e: any) { setMessage(e?.message || "Withdrawal update failed."); }
    finally { setBusy(""); }
  };

  return <div className="admin-withdraw-page">
    <div className="admin-head"><div><h1>Withdrawals</h1><p>Review, process and control earning-user withdrawal requests.</p></div><button className="admin-withdraw-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>

    <div className="admin-withdraw-stats">
      <Stat icon={Clock3} label="Pending" value={summary.pending_count || 0} accent="amber" />
      <Stat icon={RefreshCw} label="Processing" value={summary.processing_count || 0} accent="blue" />
      <Stat icon={CheckCircle2} label="Completed" value={summary.completed_count || 0} accent="green" />
      <Stat icon={XCircle} label="Rejected / Failed" value={Number(summary.rejected_count||0)+Number(summary.failed_count||0)} accent="red" />
      <Stat icon={WalletCards} label="Pending Coins" value={coins(summary.pending_coins)} accent="purple" />
    </div>

    <section className="admin-withdraw-panel">
      <div className="admin-withdraw-toolbar">
        <div className="admin-withdraw-search"><Search size={15}/><input value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search name, email or withdrawal ID" /></div>
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}>{statuses.map(s=><option key={s} value={s}>{s ? s[0].toUpperCase()+s.slice(1) : "All statuses"}</option>)}</select>
      </div>
      {message && <div className="admin-withdraw-message">{message}</div>}
      {loading ? <div className="admin-withdraw-empty">Loading withdrawal requests...</div> : !rows.length ? <div className="admin-withdraw-empty"><WalletCards size={28}/><b>No withdrawal requests found.</b><span>New requests from earning users will appear here.</span></div> : <div className="admin-withdraw-table-wrap"><table className="admin-withdraw-table"><thead><tr><th>User</th><th>Requested</th><th>Amount</th><th>Coins</th><th>Method</th><th>Status</th><th>Reference</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.user_name || "—"}</strong><small>{r.user_email || r.user_id}</small><small>{r.id}</small></td><td>{date(r.requested_at)}</td><td>{money(r.requested_amount)}</td><td>{coins(r.coins_deducted)}</td><td>{r.payment_method}</td><td><span className={`withdraw-status ${r.status}`}>{r.status}</span></td><td><input className="withdraw-ref" value={reference[r.id] ?? r.reference_id ?? ""} disabled={r.status === "completed" || r.status === "rejected" || r.status === "failed"} onChange={e=>setReference(x=>({...x,[r.id]:e.target.value}))} placeholder="UTR / reference" /></td><td><div className="withdraw-actions">{r.status === "pending" && <button onClick={()=>update(r,"processing")} disabled={busy===r.id}>PROCESS</button>}{(r.status === "pending" || r.status === "processing") && <><button className="success" onClick={()=>update(r,"completed")} disabled={busy===r.id}>COMPLETE</button><button className="danger" onClick={()=>update(r,"rejected")} disabled={busy===r.id}>REJECT</button></>}{r.status === "processing" && <button className="danger" onClick={()=>update(r,"failed")} disabled={busy===r.id}>FAILED</button>}</div></td></tr>)}</tbody></table></div>}
      <div className="admin-withdraw-pager"><span>{total ? `${(page-1)*PAGE_SIZE+1}-${Math.min(page*PAGE_SIZE,total)} of ${total}` : "0 results"}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={page*PAGE_SIZE>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
    </section>

    <section className="admin-withdraw-panel admin-withdraw-rules"><h2>Admin withdrawal control</h2><p>Pending requests can be moved to processing, completed, rejected or failed. Rejected/failed requests automatically return the deducted coins to the user's wallet through the existing wallet ledger.</p><div className="admin-withdraw-rule-grid"><div><b>Completed</b><span>Final status; reference can be stored.</span></div><div><b>Rejected / Failed</b><span>Final status; deducted coins are refunded.</span></div><div><b>Pending / Processing</b><span>Visible to admin for payout handling.</span></div></div></section>

    <style>{CSS}</style>
  </div>;
}

function Stat({ icon: Icon, label, value, accent }: any) { return <div className={`admin-withdraw-stat ${accent}`}><Icon size={18}/><span>{label}</span><strong>{value}</strong></div>; }

const CSS = String.raw`
.admin-withdraw-page{max-width:1250px;margin:0 auto;padding:22px;color:#171717}.admin-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}.admin-head h1{margin:0;font-size:28px;font-weight:950}.admin-head p{margin:5px 0 0;color:#777;font-size:12px}.admin-withdraw-refresh{display:flex;align-items:center;gap:7px;border:1px solid #eee;background:#fff;border-radius:10px;padding:10px 13px;font-size:10px;font-weight:900}.admin-withdraw-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}.admin-withdraw-stat{position:relative;padding:15px;border-radius:16px;background:#fff;border:1px solid #e8e8e8;box-shadow:0 5px 18px rgba(0,0,0,.04);overflow:hidden}.admin-withdraw-stat svg{color:#f00}.admin-withdraw-stat span{display:block;margin-top:11px;color:#777;font-size:9px;font-weight:800}.admin-withdraw-stat strong{display:block;margin-top:5px;font-size:23px;font-weight:950}.admin-withdraw-stat.amber svg{color:#e79b00}.admin-withdraw-stat.blue svg{color:#3979ff}.admin-withdraw-stat.green svg{color:#08a866}.admin-withdraw-stat.red svg{color:#e33}.admin-withdraw-stat.purple svg{color:#8b5cf6}.admin-withdraw-panel{background:#fff;border:1px solid #e6e6e6;border-radius:18px;padding:16px;box-shadow:0 7px 22px rgba(0,0,0,.035);margin-bottom:16px}.admin-withdraw-toolbar{display:flex;gap:9px;margin-bottom:14px}.admin-withdraw-search{display:flex;align-items:center;gap:7px;flex:1;border:1px solid #ddd;border-radius:11px;padding:0 11px}.admin-withdraw-search input{width:100%;height:40px;border:0;outline:0;font-size:11px}.admin-withdraw-toolbar select{width:150px;border:1px solid #ddd;border-radius:11px;padding:0 10px;background:#fff;font-size:10px;font-weight:800}.admin-withdraw-message{padding:10px;border-radius:10px;background:#fff0f0;color:#d00;font-size:10px;margin-bottom:10px}.admin-withdraw-table-wrap{overflow:auto}.admin-withdraw-table{width:100%;border-collapse:collapse;min-width:1050px}.admin-withdraw-table th{background:#fafafa;color:#777;font-size:9px;text-align:left;padding:11px;border-bottom:1px solid #eee}.admin-withdraw-table td{padding:11px;border-bottom:1px solid #eee;font-size:10px;vertical-align:middle}.admin-withdraw-table td strong,.admin-withdraw-table td small{display:block}.admin-withdraw-table td small{margin-top:3px;color:#999;font-size:8px;max-width:170px;overflow:hidden;text-overflow:ellipsis}.withdraw-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#f5f5f5;color:#666;font-size:8px;font-weight:950;text-transform:uppercase}.withdraw-status.pending{background:#fff5dc;color:#a56a00}.withdraw-status.processing{background:#eaf1ff;color:#3567c8}.withdraw-status.completed{background:#e9fff4;color:#078a48}.withdraw-status.rejected,.withdraw-status.failed{background:#fff0f0;color:#d22}.withdraw-ref{width:110px;height:32px;border:1px solid #ddd;border-radius:8px;padding:0 7px;font-size:8px}.withdraw-actions{display:flex;flex-wrap:wrap;gap:5px;max-width:150px}.withdraw-actions button{border:1px solid #ddd;background:#fff;border-radius:7px;padding:6px 7px;font-size:7px;font-weight:950}.withdraw-actions button.success{background:#eafff4;border-color:#b9efd4;color:#078a48}.withdraw-actions button.danger{background:#fff0f0;border-color:#ffd0d0;color:#d22}.withdraw-actions button:disabled{opacity:.45}.admin-withdraw-pager{display:flex;align-items:center;justify-content:space-between;padding-top:13px;color:#888;font-size:9px}.admin-withdraw-pager div{display:flex;gap:6px}.admin-withdraw-pager button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:7px 9px;font-size:8px}.admin-withdraw-pager button:disabled{opacity:.4}.admin-withdraw-empty{min-height:170px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa;font-size:9px}.admin-withdraw-empty b{color:#666;font-size:12px}.admin-withdraw-rules h2{margin:0;font-size:17px}.admin-withdraw-rules p{color:#777;font-size:10px;line-height:1.6}.admin-withdraw-rule-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.admin-withdraw-rule-grid div{padding:12px;border-radius:11px;background:#fafafa;border:1px solid #eee}.admin-withdraw-rule-grid b,.admin-withdraw-rule-grid span{display:block}.admin-withdraw-rule-grid b{font-size:10px}.admin-withdraw-rule-grid span{margin-top:4px;color:#888;font-size:8px;line-height:1.4}
@media(max-width:900px){.admin-withdraw-stats{grid-template-columns:repeat(2,1fr)}.admin-withdraw-rule-grid{grid-template-columns:1fr}.admin-withdraw-page{padding:14px}.admin-head h1{font-size:23px}}
@media(max-width:560px){.admin-withdraw-toolbar{flex-direction:column}.admin-withdraw-toolbar select{width:100%;height:40px}.admin-withdraw-stats{grid-template-columns:1fr 1fr}.admin-head{align-items:flex-start}.admin-withdraw-refresh{padding:8px 10px}}
`;
