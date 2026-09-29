import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coins,
  Edit3,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { dataProvider } from "@/services/dataProvider";

const PAGE_SIZE = 20;

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function statusLabel(status: string) {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) || "Active";
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`admin-user360-status ${status || "active"}`}>{statusLabel(status)}</span>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="admin-user360-stat">
      <span className="admin-user360-stat-icon"><Icon size={18} /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="admin-user360-empty">{children}</div>;
}

function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="admin-user360-pager">
      <span>{Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}</span>
      <div>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
        <b>{page}</b>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { userId } = useParams();
  return userId ? <AdminUserDetails userId={userId} /> : <AdminUsersList />;
}

function AdminUsersList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await dataProvider.adminListUsers({ page, pageSize: PAGE_SIZE, search: search.trim(), status }));
    } catch (e: any) {
      setError(e?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-user360-page">
      <div className="admin-head admin-user360-head">
        <div><h1>Users</h1><p>Manage accounts and open a complete User 360° profile.</p></div>
        <button className="admin-user360-refresh" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button>
      </div>

      <div className="admin-user360-toolbar">
        <label className="admin-user360-search"><Search size={17} /><input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search name, email or user ID" /></label>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
        </select>
      </div>

      {error && <div className="admin-user360-error"><CircleAlert size={16} /> {error}</div>}
      <div className="admin-user360-table-wrap">
        <table className="admin-user360-table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Email</th><th>Coins</th><th>Joined</th><th>Last active</th><th /></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8}><EmptyState>Loading users…</EmptyState></td></tr>}
            {!loading && !data.rows.length && <tr><td colSpan={8}><EmptyState>No users found.</EmptyState></td></tr>}
            {!loading && data.rows.map((u) => (
              <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} className="admin-user360-clickable">
                <td><div className="admin-user360-user"><div className="admin-user360-avatar">{u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : (u.name || u.email || "U")[0].toUpperCase()}</div><div><strong>{u.name || "User"}</strong><small>{u.id}</small></div></div></td>
                <td><span className={`admin-user360-role ${u.role || "user"}`}>{u.role || "user"}</span></td>
                <td><StatusBadge status={u.status} /></td>
                <td>{u.email}</td>
                <td><b>{formatNumber(u.coinBalance)}</b></td>
                <td>{formatDateOnly(u.createdAt)}</td>
                <td>{formatDate(u.lastActiveAt)}</td>
                <td><button className="admin-user360-open" onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${u.id}`); }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

function AdminUserDetails({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [modal, setModal] = useState<"coins" | "status" | "edit" | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("500");
  const [newStatus, setNewStatus] = useState("active");
  const [newName, setNewName] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true); setError("");
    try { setOverview(await dataProvider.adminGetUserOverview(userId)); }
    catch (e: any) { setError(e?.message || "Unable to load user details."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (overview?.user) {
      setNewStatus(overview.user.status || "active");
      setNewName(overview.user.name || "");
    }
  }, [overview?.user]);

  const closeModal = () => { setModal(null); setReason(""); };

  const runAction = async () => {
    setActionBusy(true);
    try {
      if (modal === "coins") {
        const parsed = Number(amount);
        if (!Number.isFinite(parsed) || parsed === 0) throw new Error("Enter a non-zero coin amount.");
        await dataProvider.adminAdjustUserCoins(userId, parsed, reason.trim());
      } else if (modal === "status") {
        await dataProvider.adminUpdateUserStatus(userId, newStatus, reason.trim());
      } else if (modal === "edit") {
        await dataProvider.adminUpdateUserName(userId, newName.trim());
      }
      closeModal();
      await loadOverview();
    } catch (e: any) {
      setError(e?.message || "Action failed.");
    } finally { setActionBusy(false); }
  };

  if (loading && !overview) return <div className="admin-user360-page"><div className="admin-user360-loading">Loading User 360°…</div></div>;
  if (!overview) return <div className="admin-user360-page"><div className="admin-user360-error"><CircleAlert size={16} /> {error || "User not found."}</div></div>;

  const u = overview.user;
  const c = overview.coins;
  const e = overview.earnings;
  const v = overview.viewActivity;
  const cs = overview.campaigns;
  const avgWatch = Number(v.averageWatchSeconds || 0);
  const usdPerCoin = Number(e.usdPerCoin || 0.0002);

  return (
    <div className="admin-user360-page">
      <div className="admin-user360-detail-head">
        <button className="admin-user360-back" onClick={() => navigate("/admin/users")}><ArrowLeft size={17} /> Users</button>
        <button className="admin-user360-refresh" onClick={loadOverview} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button>
      </div>

      {error && <div className="admin-user360-error"><CircleAlert size={16} /> {error}</div>}

      <section className="admin-user360-profile-card">
        <div className="admin-user360-profile-avatar">{u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : (u.name || u.email || "U")[0].toUpperCase()}</div>
        <div className="admin-user360-profile-main">
          <div className="admin-user360-title-line"><div><h1>{u.name || "User"}</h1><span className="admin-user360-id">#{u.id}</span></div><div className="admin-user360-title-badges"><span className={`admin-user360-role ${u.role || "user"}`}>{u.role || "user"}</span><StatusBadge status={u.status} /></div></div>
          <div className="admin-user360-profile-meta"><span><Mail size={14} /> {u.email}</span><span>Joined {formatDate(u.createdAt)}</span><span>Last active {formatDate(u.lastActiveAt)}</span><span>{u.emailVerified ? <><CheckCircle2 size={14} /> Email verified</> : <><CircleAlert size={14} /> Email not verified</>}</span></div>
        </div>
        <div className="admin-user360-actions">
          <button onClick={() => setModal("edit")}><Edit3 size={15} /> Edit User</button>
          <button onClick={() => { setAmount("500"); setReason(""); setModal("coins"); }}><Coins size={15} /> Adjust Coins</button>
          <button onClick={() => { setNewStatus(u.status === "active" ? "suspended" : "active"); setReason(""); setModal("status"); }}><ShieldCheck size={15} /> {u.status === "active" ? "Suspend" : "Unsuspend"}</button>
          <button className="danger" onClick={() => { setNewStatus(u.status === "banned" ? "active" : "banned"); setReason(""); setModal("status"); }}><Ban size={15} /> {u.status === "banned" ? "Unban" : "Ban"}</button>
        </div>
      </section>

      <div className="admin-user360-stats-grid">
        <StatCard label="Coin Balance" value={`${formatNumber(c.currentBalance)} Coins`} icon={Coins} />
        <StatCard label="Total Earned" value={`${formatNumber(c.totalEarned)} Coins`} icon={ArrowDownLeft} />
        <StatCard label="Total Spent" value={`${formatNumber(c.totalSpent)} Coins`} icon={ArrowUpRight} />
        <StatCard label="Videos Completed" value={formatNumber(v.completed)} icon={CheckCircle2} />
        <StatCard label="Campaigns" value={formatNumber(cs.created)} icon={WalletCards} />
        <StatCard label="INR Earned" value={`₹${Number(e.totalUsdEquivalent || 0).toFixed(2)}`} icon={Coins} />
      </div>

      <div className="admin-user360-two-col">
        <section className="admin-user360-panel"><SectionTitle title="Coin statistics" /><div className="admin-user360-kpi-grid">
          <Kpi label="Current balance" value={`${formatNumber(c.currentBalance)} Coins`} /><Kpi label="Purchased" value={`+${formatNumber(c.totalPurchased)}`} /><Kpi label="Earned" value={`+${formatNumber(c.totalEarned)}`} /><Kpi label="Spent" value={`-${formatNumber(c.totalSpent)}`} /><Kpi label="Viewer rewards" value={`+${formatNumber(c.totalViewerRewards)}`} /><Kpi label="Campaign spend" value={`-${formatNumber(c.campaignSpend)}`} /><Kpi label="Refunded" value={`+${formatNumber(c.refunded)}`} />
        </div></section>
        <section className="admin-user360-panel"><SectionTitle title="Earnings & withdrawals" /><div className="admin-user360-kpi-grid">
          <Kpi label="INR / coin" value={`₹${usdPerCoin}`} /><Kpi label="INR equivalent" value={`₹${Number(e.totalUsdEquivalent || 0).toFixed(2)}`} /><Kpi label="Withdrawn" value={`${formatNumber(e.totalWithdrawnCoins)} Coins`} /><Kpi label="Pending withdrawal" value={`${formatNumber(e.pendingWithdrawalCoins)} Coins`} /><Kpi label="Available balance" value={`${formatNumber(e.availableWithdrawalCoins)} Coins`} /><Kpi label="Withdrawals" value={formatNumber(e.withdrawalCount)} /><Kpi label="Last withdrawal" value={formatDate(e.lastWithdrawalAt)} />
        </div></section>
      </div>

      <section className="admin-user360-panel"><SectionTitle title="Viewing / task activity" /><div className="admin-user360-kpi-grid admin-user360-kpi-6">
        <Kpi label="Videos watched" value={formatNumber(v.videosWatched)} /><Kpi label="Completed" value={formatNumber(v.completed)} /><Kpi label="Incomplete" value={formatNumber(v.incomplete)} /><Kpi label="Total watch time" value={formatDuration(v.totalWatchSeconds)} /><Kpi label="Average watch" value={formatDuration(avgWatch)} /><Kpi label="Coins from watching" value={formatNumber(v.coinsEarnedFromWatching)} /><Kpi label="Last video" value={v.lastVideoWatchedTitle || formatDate(v.lastVideoWatchedAt)} />
      </div></section>

      <section className="admin-user360-panel"><SectionTitle title="Campaign statistics" /><div className="admin-user360-kpi-grid admin-user360-kpi-6">
        <Kpi label="Created" value={formatNumber(cs.created)} /><Kpi label="Active" value={formatNumber(cs.active)} /><Kpi label="Completed" value={formatNumber(cs.completed)} /><Kpi label="Paused" value={formatNumber(cs.paused)} /><Kpi label="Cancelled" value={formatNumber(cs.cancelled)} /><Kpi label="Campaign coins spent" value={formatNumber(cs.coinsSpent)} /><Kpi label="Target users" value={formatNumber(cs.targetUsers)} /><Kpi label="Completed users" value={formatNumber(cs.completedUsers)} />
      </div></section>

      <UserCampaignHistory userId={userId} />
      <UserTransactions userId={userId} />
      <UserWithdrawals userId={userId} />
      <UserActivity userId={userId} />

      {modal && <ActionModal modal={modal} amount={amount} setAmount={setAmount} reason={reason} setReason={setReason} newStatus={newStatus} setNewStatus={setNewStatus} newName={newName} setNewName={setNewName} busy={actionBusy} onClose={closeModal} onSubmit={runAction} />}
    </div>
  );
}

function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return <div className="admin-user360-section-title"><h2>{title}</h2>{right}</div>;
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="admin-user360-kpi"><span>{label}</span><strong>{value}</strong></div>;
}

function UserCampaignHistory({ userId }: { userId: string }) {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(""); const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [data, setData] = useState<any>({ rows: [], total: 0 });
  const load = useCallback(async () => { setData(await dataProvider.adminListUserCampaigns({ userId, page, pageSize: PAGE_SIZE, status, dateFrom: dateFrom ? `${dateFrom}T00:00:00` : null, dateTo: dateTo ? `${dateTo}T23:59:59` : null })); }, [userId,page,status,dateFrom,dateTo]);
  useEffect(() => { load().catch(() => setData({rows:[],total:0})); }, [load]);
  const filters = (
    <div className="admin-user360-filter-row">
      <select
        className="admin-user360-filter"
        value={status}
        onChange={(e) => {
          setPage(1);
          setStatus(e.target.value);
        }}
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="paused">Paused</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <input
        type="date"
        className="admin-user360-filter"
        value={dateFrom}
        onChange={(e) => {
          setPage(1);
          setDateFrom(e.target.value);
        }}
      />

      <input
        type="date"
        className="admin-user360-filter"
        value={dateTo}
        onChange={(e) => {
          setPage(1);
          setDateTo(e.target.value);
        }}
      />
    </div>
  );

  return (
    <section className="admin-user360-panel">
      <SectionTitle title="Campaign history" right={filters} />

      {!data.rows.length ? (
        <EmptyState>No campaigns found.</EmptyState>
      ) : (
        <div className="admin-user360-table-wrap">
          <table className="admin-user360-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Video</th>
                <th>Target</th>
                <th>Watch</th>
                <th>Reward/User</th>
                <th>Cost</th>
                <th>Completed</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    <small>{r.id}</small>
                  </td>
                  <td>{r.content_title}</td>
                  <td>{formatNumber(r.target_users)}</td>
                  <td>{formatDuration(r.required_watch_seconds)}</td>
                  <td>{formatNumber(r.reward_per_user)}</td>
                  <td>{formatNumber(r.campaign_cost)}</td>
                  <td>{formatNumber(r.completed_users)}/{formatNumber(r.target_users)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{formatDateOnly(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />
    </section>
  );
}

function UserTransactions({ userId }: { userId: string }) {
  const [page,setPage]=useState(1); const [type,setType]=useState(""); const [search,setSearch]=useState(""); const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState(""); const [data,setData]=useState<any>({rows:[],total:0});
  const load=useCallback(async()=>{setData(await dataProvider.adminListUserTransactions({userId,page,pageSize:PAGE_SIZE,type,search,dateFrom:dateFrom?`${dateFrom}T00:00:00`:null,dateTo:dateTo?`${dateTo}T23:59:59`:null}));},[userId,page,type,search,dateFrom,dateTo]);
  useEffect(()=>{load().catch(()=>setData({rows:[],total:0}));},[load]);
  const positive=(t:string)=>["purchase","earning","bonus","refund","referral"].includes(t);
  return <section className="admin-user360-panel"><SectionTitle title="Coin transaction history" right={<div className="admin-user360-filter-row"><input className="admin-user360-filter-input" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search description"/><select className="admin-user360-filter" value={type} onChange={e=>{setPage(1);setType(e.target.value)}}><option value="">All types</option><option value="purchase">Purchase</option><option value="earning">Viewer reward</option><option value="spend">Campaign spend</option><option value="refund">Refund</option><option value="bonus">Bonus</option><option value="referral">Referral</option><option value="admin_adjustment">Admin adjustment</option></select><input type="date" className="admin-user360-filter" value={dateFrom} onChange={e=>{setPage(1);setDateFrom(e.target.value)}}/><input type="date" className="admin-user360-filter" value={dateTo} onChange={e=>{setPage(1);setDateTo(e.target.value)}}/></div>} />
    {!data.rows.length?<EmptyState>No wallet transactions found.</EmptyState>:<div className="admin-user360-table-wrap"><table className="admin-user360-table"><thead><tr><th>Date & time</th><th>Type</th><th>Description</th><th>Coins</th><th>Balance after</th><th>Related</th><th>Status</th></tr></thead><tbody>{data.rows.map((r:any)=><tr key={r.id}><td>{formatDate(r.created_at)}</td><td><span className="admin-user360-tx-type">{statusLabel(r.type)}</span></td><td>{r.description}</td><td className={positive(r.type)?"positive":"negative"}>{positive(r.type)?"+":"-"}{formatNumber(r.coins)}</td><td>{formatNumber(r.balance_after)}</td><td>{r.reference_id||"—"}</td><td><StatusBadge status={r.status}/></td></tr>)}</tbody></table></div>}
    <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage}/>
  </section>;
}

function UserWithdrawals({ userId }: { userId: string }) {
  const [page,setPage]=useState(1); const [status,setStatus]=useState(""); const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState(""); const [data,setData]=useState<any>({rows:[],total:0});
  const load=useCallback(async()=>{setData(await dataProvider.adminListUserWithdrawals({userId,page,pageSize:PAGE_SIZE,status}));},[userId,page,status]);
  useEffect(()=>{load().catch(()=>setData({rows:[],total:0}));},[load]);
  return <section className="admin-user360-panel"><SectionTitle title="Withdrawal history" right={<select className="admin-user360-filter" value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">All statuses</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="failed">Failed</option></select>} />
    {!data.rows.length?<EmptyState>No withdrawals recorded.</EmptyState>:<div className="admin-user360-table-wrap"><table className="admin-user360-table"><thead><tr><th>Withdrawal ID</th><th>Date</th><th>Amount</th><th>Coins</th><th>Method</th><th>Status</th><th>Reference</th><th>Completed</th></tr></thead><tbody>{data.rows.map((r:any)=><tr key={r.id}><td>{r.id}</td><td>{formatDate(r.requested_at)}</td><td>{r.requested_amount}</td><td>{formatNumber(r.coins_deducted)}</td><td>{r.payment_method}</td><td><StatusBadge status={r.status}/></td><td>{r.reference_id||"—"}</td><td>{formatDate(r.completed_at)}</td></tr>)}</tbody></table></div>}
    <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage}/>
  </section>;
}

function UserActivity({ userId }: { userId: string }) {
  const [page,setPage]=useState(1); const [type,setType]=useState(""); const [data,setData]=useState<any>({rows:[],total:0});
  const load=useCallback(async()=>{setData(await dataProvider.adminListUserActivity({userId,page,pageSize:PAGE_SIZE,type}));},[userId,page,type]);
  useEffect(()=>{load().catch(()=>setData({rows:[],total:0}));},[load]);
  return <section className="admin-user360-panel"><SectionTitle title="User activity timeline" right={<select className="admin-user360-filter" value={type} onChange={e=>{setPage(1);setType(e.target.value)}}><option value="">All events</option><option value="account_created">Account created</option><option value="email_verified">Email verified</option><option value="campaign_created">Campaign created</option><option value="task_completed">Task completed</option><option value="coins_adjusted">Admin adjustment</option></select>} />
    {!data.rows.length?<EmptyState>No activity recorded.</EmptyState>:<div className="admin-user360-timeline">{data.rows.map((r:any)=><div className="admin-user360-event" key={r.id}><span className="admin-user360-event-dot"/><div><div className="admin-user360-event-top"><strong>{r.title}</strong><time>{formatDate(r.occurred_at)}</time></div><p>{r.description}</p></div></div>)}</div>}
    <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage}/>
  </section>;
}

function ActionModal(props: any) {
  const { modal, amount, setAmount, reason, setReason, newStatus, setNewStatus, newName, setNewName, busy, onClose, onSubmit } = props;
  const title = modal === "coins" ? "Adjust user coins" : modal === "status" ? "Update account status" : "Edit user";
  const canSubmit = modal === "edit" ? newName.trim() : modal === "coins" ? Number(amount) !== 0 && reason.trim() : reason.trim() || newStatus === "active";
  return <div className="admin-user360-modal-backdrop" onMouseDown={onClose}><div className="admin-user360-modal" onMouseDown={e=>e.stopPropagation()}><div className="admin-user360-modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>
    {modal === "coins" && <><p className="admin-user360-modal-note">Every manual adjustment is recorded in the wallet ledger and admin audit trail.</p><label>Amount (+ add / − remove)<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why is this adjustment required?"/></label></>}
    {modal === "status" && <><label>Status<select value={newStatus} onChange={e=>setNewStatus(e.target.value)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option></select></label><label>Reason<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Optional for active, required for suspension/ban"/></label></>}
    {modal === "edit" && <label>Full name<input value={newName} onChange={e=>setNewName(e.target.value)} /></label>}
    <div className="admin-user360-modal-actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!canSubmit || busy} onClick={onSubmit}>{busy?"Saving…":"Save changes"}</button></div>
  </div></div>;
}

const USER_360_CSS = String.raw`
.admin-user360-page{width:100%;max-width:1180px;margin:0 auto;padding-bottom:30px}.admin-user360-head{align-items:center}.admin-user360-head p{max-width:none}.admin-user360-refresh,.admin-user360-back,.admin-user360-open,.admin-user360-actions button,.admin-user360-modal-actions button{border:1px solid #e1e1e1;background:#fff;border-radius:8px;min-height:36px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;color:#333;font-weight:800;font-size:11px}.admin-user360-refresh:hover,.admin-user360-back:hover,.admin-user360-actions button:hover,.admin-user360-open:hover{border-color:#bbb;background:#fafafa}.admin-user360-toolbar{display:flex;gap:10px;margin-bottom:12px}.admin-user360-search{height:40px;background:#fff;border:1px solid #e3e3e3;border-radius:9px;display:flex;align-items:center;gap:8px;padding:0 12px;flex:1;color:#888}.admin-user360-search input{border:0;outline:0;width:100%;background:transparent;font-size:12px}.admin-user360-toolbar select,.admin-user360-filter{height:40px;border:1px solid #e3e3e3;border-radius:8px;background:#fff;padding:0 10px;font-size:11px}.admin-user360-table-wrap{width:100%;overflow:auto;border:1px solid #e5e5e5;border-radius:10px;background:#fff}.admin-user360-table{width:100%;border-collapse:collapse;min-width:860px}.admin-user360-table th{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#777;text-align:left;background:#fafafa;padding:11px;border-bottom:1px solid #e5e5e5;white-space:nowrap}.admin-user360-table td{font-size:11px;padding:12px 11px;border-bottom:1px solid #eee;vertical-align:middle}.admin-user360-table tbody tr:last-child td{border-bottom:0}.admin-user360-clickable{cursor:pointer}.admin-user360-clickable:hover{background:#fcfcfc}.admin-user360-user{display:flex;align-items:center;gap:9px}.admin-user360-avatar,.admin-user360-profile-avatar{display:grid;place-items:center;background:#171717;color:#fff;font-weight:950;overflow:hidden}.admin-user360-avatar img,.admin-user360-profile-avatar img{width:100%;height:100%;object-fit:cover}.admin-user360-avatar{width:34px;height:34px;border-radius:9px;font-size:14px}.admin-user360-user strong,.admin-user360-user small,.admin-user360-table td strong,.admin-user360-table td small{display:block}.admin-user360-user small,.admin-user360-table td small{color:#999;font-size:9px;margin-top:3px;max-width:190px;overflow:hidden;text-overflow:ellipsis}.admin-user360-role{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:900;background:#f1f1f1;color:#555;white-space:nowrap;text-transform:capitalize}.admin-user360-role.admin{background:#ffe8e8;color:#b52323}.admin-user360-role.creator{background:#fff2d8;color:#8a5b00}.admin-user360-role.user{background:#eef4ff;color:#315d9a}.admin-user360-title-badges{display:flex;align-items:center;gap:6px}.admin-user360-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:900;background:#eee;color:#555;white-space:nowrap}.admin-user360-status.active{background:#e9f8ef;color:#18733b}.admin-user360-status.suspended{background:#fff5df;color:#986000}.admin-user360-status.banned{background:#ffe9e9;color:#a32222}.admin-user360-open{min-height:30px}.admin-user360-pager{display:flex;align-items:center;justify-content:space-between;padding:11px 2px;color:#777;font-size:10px}.admin-user360-pager div{display:flex;align-items:center;gap:7px}.admin-user360-pager button{width:30px;height:30px;border:1px solid #ddd;background:#fff;border-radius:7px;display:grid;place-items:center}.admin-user360-pager button:disabled{opacity:.4}.admin-user360-pager b{color:#222}.admin-user360-error{display:flex;gap:7px;align-items:center;background:#fff0f0;border:1px solid #ffd0d0;color:#a32222;border-radius:8px;padding:10px 12px;font-size:11px;margin-bottom:12px}.admin-user360-loading,.admin-user360-empty{text-align:center;padding:35px;color:#888;font-size:11px}.admin-user360-detail-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.admin-user360-profile-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:17px;display:grid;grid-template-columns:auto 1fr auto;gap:15px;align-items:center}.admin-user360-profile-avatar{width:62px;height:62px;border-radius:14px;font-size:25px}.admin-user360-title-line{display:flex;justify-content:space-between;align-items:center;gap:10px}.admin-user360-title-line h1{margin:0;font-size:23px}.admin-user360-id{font-size:9px;color:#999;word-break:break-all}.admin-user360-profile-meta{display:flex;flex-wrap:wrap;gap:8px 15px;margin-top:8px;color:#777;font-size:10px}.admin-user360-profile-meta span{display:inline-flex;align-items:center;gap:5px}.admin-user360-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.admin-user360-actions button.danger{color:#a32222;border-color:#ffd0d0}.admin-user360-stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin:12px 0}.admin-user360-stat{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:12px;display:flex;gap:9px;align-items:center;min-width:0}.admin-user360-stat-icon{width:32px;height:32px;border-radius:8px;background:#f7f7f7;display:grid;place-items:center;color:#FF0000;flex:0 0 auto}.admin-user360-stat strong{display:block;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.admin-user360-stat div>span{display:block;color:#777;font-size:9px;margin-top:3px}.admin-user360-two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.admin-user360-panel{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:15px;margin-top:12px;min-width:0}.admin-user360-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.admin-user360-section-title h2{font-size:14px;margin:0}.admin-user360-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.admin-user360-kpi{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:10px;min-width:0}.admin-user360-kpi span{display:block;color:#777;font-size:9px;margin-bottom:4px}.admin-user360-kpi strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.admin-user360-kpi-6{grid-template-columns:repeat(4,1fr)}.admin-user360-filter{height:32px;font-size:10px}.admin-user360-filter-row{display:flex;gap:7px}.admin-user360-filter-input{height:32px;border:1px solid #e3e3e3;border-radius:8px;padding:0 9px;font-size:10px;min-width:150px}.admin-user360-tx-type{font-size:9px;font-weight:900}.positive{color:#16823e;font-weight:900}.negative{color:#b52323;font-weight:900}.admin-user360-timeline{display:flex;flex-direction:column}.admin-user360-event{display:grid;grid-template-columns:15px 1fr;gap:10px;position:relative;padding:0 0 16px}.admin-user360-event:not(:last-child):before{content:"";position:absolute;left:6px;top:14px;bottom:0;width:1px;background:#e4e4e4}.admin-user360-event-dot{width:13px;height:13px;border-radius:50%;background:#FF0000;border:3px solid #ffe4e4;position:relative;z-index:1}.admin-user360-event-top{display:flex;justify-content:space-between;gap:10px}.admin-user360-event-top strong{font-size:11px}.admin-user360-event time{font-size:9px;color:#999}.admin-user360-event p{font-size:10px;color:#777;margin:4px 0 0}.admin-user360-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:grid;place-items:center;padding:15px}.admin-user360-modal{width:min(440px,100%);background:#fff;border-radius:12px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.22)}.admin-user360-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.admin-user360-modal-head h2{margin:0;font-size:16px}.admin-user360-modal-head button{border:0;background:transparent;font-size:24px;color:#888}.admin-user360-modal label{display:block;font-size:10px;font-weight:800;margin:10px 0}.admin-user360-modal input,.admin-user360-modal textarea,.admin-user360-modal select{display:block;width:100%;margin-top:5px;border:1px solid #ddd;border-radius:8px;padding:9px;font-size:11px;outline:none;background:#fff}.admin-user360-modal textarea{min-height:80px;resize:vertical}.admin-user360-modal-note{font-size:10px;color:#777;margin:0 0 10px}.admin-user360-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}.admin-user360-modal-actions .primary{background:#FF0000;color:#fff;border-color:#FF0000}.admin-user360-modal-actions button:disabled{opacity:.5}.spin{animation:adminUser360Spin 1s linear infinite}@keyframes adminUser360Spin{to{transform:rotate(360deg)}}
@media(max-width:1050px){.admin-user360-stats-grid{grid-template-columns:repeat(3,1fr)}.admin-user360-profile-card{grid-template-columns:auto 1fr}.admin-user360-actions{grid-column:1/-1;justify-content:flex-start}.admin-user360-kpi-6{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.admin-user360-toolbar,.admin-user360-filter-row{flex-direction:column}.admin-user360-toolbar select{width:100%}.admin-user360-stats-grid{grid-template-columns:1fr 1fr}.admin-user360-two-col{grid-template-columns:1fr}.admin-user360-kpi-grid,.admin-user360-kpi-6{grid-template-columns:1fr 1fr}.admin-user360-profile-card{grid-template-columns:auto 1fr}.admin-user360-title-line{align-items:flex-start;flex-direction:column}.admin-user360-actions{grid-column:1/-1}.admin-user360-actions button{flex:1}.admin-user360-section-title{align-items:flex-start;flex-direction:column}.admin-user360-filter-row{width:100%}.admin-user360-filter-input,.admin-user360-filter{width:100%}}
@media(max-width:480px){.admin-user360-profile-card{grid-template-columns:1fr}.admin-user360-profile-avatar{width:52px;height:52px}.admin-user360-stats-grid{grid-template-columns:1fr}.admin-user360-kpi-grid,.admin-user360-kpi-6{grid-template-columns:1fr}.admin-user360-actions{display:grid;grid-template-columns:1fr 1fr}.admin-user360-head{align-items:flex-start;gap:8px}.admin-user360-refresh{min-width:90px}}
`;

if (typeof document !== "undefined" && !document.querySelector("style[data-engage-user360]") ) {
  const style = document.createElement("style");
  style.setAttribute("data-engage-user360", "true");
  style.textContent = USER_360_CSS;
  document.head.appendChild(style);
}
