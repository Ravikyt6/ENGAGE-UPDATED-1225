import React from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Coins,
  History,
  IndianRupee,
  Plus,
  RefreshCw,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

interface WalletTransaction {
  id: string;
  type: "earning" | "spend" | "purchase" | "bonus" | "refund" | "withdrawal" | "admin_adjustment" | "referral";
  coins: number;
  balanceAfter: number;
  description: string;
  referenceId?: string | null;
  createdAt: string;
}

type Filter = "all" | "earning" | "spend" | "withdrawal";

function UserWalletPage() {
  const { user } = useAuth();
  const data = useData();
  const wallet = data.wallet || { coins: 0, earnings: 0 };
  const isPromotion = user?.role === "admin" || user?.role === "creator" || user?.accountType === "promotion";

  const [transactions, setTransactions] = React.useState<WalletTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = React.useState(true);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [withdrawCoins, setWithdrawCoins] = React.useState(100);
  const [paymentMethod, setPaymentMethod] = React.useState("UPI");
  const [paymentDetails, setPaymentDetails] = React.useState("");
  const [withdrawLoading, setWithdrawLoading] = React.useState(false);
  const [withdrawMessage, setWithdrawMessage] = React.useState("");

  const coinValue = 0.0002;
  const maxWithdrawCoins = Math.floor(Number(wallet.coins || 0));
  const requestedAmount = Math.max(0, Number(withdrawCoins || 0)) * coinValue;
  const [milestoneViews, setMilestoneViews] = React.useState(0);
  const [milestoneCompleted, setMilestoneCompleted] = React.useState<number[]>([]);
  const milestoneDefs = (data.milestones || []).filter((m:any) => m.active !== false && Number(m.views) > 0 && Number(m.rewardRupees) > 0).map((m:any) => ({ views:Number(m.views), reward:Number(m.rewardRupees) })).sort((a:any,b:any)=>a.views-b.views);
  const loadMilestones = React.useCallback(() => {
    if (!user?.id) return;
    try {
      const completedState = JSON.parse(localStorage.getItem("engage_view_milestones_v1") || "{}") as Record<string, number[]>;
      const completed = Array.isArray(completedState[user.id]) ? completedState[user.id] : [];
      const totalQualifiedViews = Object.keys(localStorage).filter((key) => key.startsWith("engage_campaign_qualification_") && key.endsWith(`_${user.id}`)).length;
      setMilestoneViews(totalQualifiedViews);
      setMilestoneCompleted(completed);
    } catch {
      setMilestoneViews(0);
      setMilestoneCompleted([]);
    }
  }, [user?.id]);

  const loadTransactions = React.useCallback(async () => {
    if (!user?.id) return;
    setLoadingTransactions(true);
    try {
      const rows = await data.getWalletTransactions(user.id);
      setTransactions((rows || []) as WalletTransaction[]);
    } catch (error) {
      console.error("Wallet transactions load failed:", error);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [data, user?.id]);

  React.useEffect(() => { loadTransactions(); }, [loadTransactions]);
  React.useEffect(() => { loadMilestones(); }, [loadMilestones]);

  const filteredTransactions = React.useMemo(() => {
    if (filter === "all") return transactions;
    if (filter === "spend") return transactions.filter((tx) => tx.type === "spend");
    if (filter === "withdrawal") return transactions.filter((tx) => tx.type === "withdrawal");
    return transactions.filter((tx) => tx.type === "earning" || tx.type === "bonus" || tx.type === "refund" || tx.type === "referral");
  }, [transactions, filter]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const typeLabel = (type: WalletTransaction["type"]) => ({
    spend: "Campaign Spend",
    earning: "Viewer Reward",
    purchase: "Coin Purchase",
    refund: "Refund",
    bonus: "Bonus",
    withdrawal: "Withdrawal Request",
    admin_adjustment: "Balance Adjustment",
    referral: "Referral Reward",
  }[type]);

  const isCredit = (type: WalletTransaction["type"]) =>
    !["spend", "withdrawal"].includes(type);

  const openWithdraw = () => {
    setWithdrawMessage("");
    setWithdrawCoins(Math.min(100, Math.max(100, maxWithdrawCoins)));
    setPaymentMethod("UPI");
    setPaymentDetails("");
    setWithdrawOpen(true);
  };

  const submitWithdrawal = async () => {
    const coins = Math.floor(Number(withdrawCoins || 0));

    if (coins < 100) {
      setWithdrawMessage("Minimum withdrawal is 100 coins.");
      return;
    }

    if (coins > maxWithdrawCoins) {
      setWithdrawMessage("You do not have enough coins for this withdrawal.");
      return;
    }

    if (!paymentDetails.trim()) {
      setWithdrawMessage(paymentMethod === "UPI" ? "Enter your UPI ID." : "Enter your payment details.");
      return;
    }

    setWithdrawLoading(true);
    setWithdrawMessage("");

    try {
      await data.requestWithdrawal({
        userId: user?.id,
        coins,
        paymentMethod,
        paymentDetails: paymentDetails.trim(),
      });

      setWithdrawMessage("Withdrawal request submitted successfully.");
      await loadTransactions();
      await data.refresh();

      window.setTimeout(() => setWithdrawOpen(false), 900);
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      setWithdrawMessage(error?.message || "Withdrawal request failed. Please try again.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const earningTransactions = transactions.filter((tx) => tx.type === "earning" || tx.type === "bonus" || tx.type === "refund" || tx.type === "referral");
  const withdrawalTransactions = transactions.filter((tx) => tx.type === "withdrawal");
  const totalWithdrawnCoins = withdrawalTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.coins || 0)), 0);
  const todayKey = new Date().toDateString();
  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const todayEarnings = earningTransactions.filter((tx) => new Date(tx.createdAt).toDateString() === todayKey).reduce((sum, tx) => sum + Math.abs(Number(tx.coins || 0)) * coinValue, 0);
  const monthEarnings = earningTransactions.filter((tx) => { const d = new Date(tx.createdAt); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; }).reduce((sum, tx) => sum + Math.abs(Number(tx.coins || 0)) * coinValue, 0);

  return (
    <Layout>
      <div className="wallet-page">
        <section className="wallet-heading"><div className="wallet-heading-icon"><WalletCards size={21}/></div><div><h1>Wallet</h1><p>{isPromotion ? "Manage coins used for your campaigns." : "Manage your coins, rewards and withdrawals."}</p></div></section>
        <section className="wallet-kpi-grid">
          <div className="wallet-kpi"><span>Available Balance</span><strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong><small>available earnings</small><i><IndianRupee size={17}/></i></div>
          <div className="wallet-kpi"><span>Available Coins</span><strong>{Number(wallet.coins || 0).toLocaleString()}</strong><small>current balance</small><i><Coins size={17}/></i></div>
          <div className="wallet-kpi"><span>Lifetime Earned</span><strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong><small>total rewards earned</small><i><Sparkles size={17}/></i></div>
          <div className="wallet-kpi"><span>Total Withdrawn</span><strong>₹{(totalWithdrawnCoins * coinValue).toFixed(2)}</strong><small>paid out</small><i><ArrowUpRight size={17}/></i></div>
        </section>

        <section className="wallet-viewer-card"><div className="wallet-viewer-head"><WalletCards size={21}/><h2>{isPromotion ? "Campaign Wallet" : "Viewer Wallet"}</h2></div><span className="wallet-available-label">Available Balance</span><strong className="wallet-available">₹{Number(wallet.earnings || 0).toFixed(2)}</strong><div className="wallet-viewer-stats"><span><b>◷</b> On Hold: <strong>₹0.00</strong></span><span><b>✓</b> Lifetime Earned: <strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong></span></div>{!isPromotion?<button type="button" className="wallet-withdraw-btn" onClick={openWithdraw} disabled={maxWithdrawCoins<100}><IndianRupee size={17}/> Withdraw</button>:<Link to="/create-campaign" className="wallet-withdraw-btn campaign-link"><Plus size={17}/> Create Campaign</Link>}<div className="wallet-withdraw-note">Minimum withdrawal: ₹20.00</div>{!isPromotion&&<div className="wallet-withdraw-help">{maxWithdrawCoins>=100?"You can request a withdrawal from your available coins.":"You need at least ₹20.00 to withdraw."}</div>}</section>
        {!isPromotion && <section className="wallet-milestone-card">
          <div className="wallet-milestone-head"><div><h2>View Milestones</h2><p>All available qualified-view milestones and rewards.</p></div><span>{milestoneDefs.length} TOTAL</span></div>
          {milestoneDefs.length ? <div className="wallet-milestone-list">{milestoneDefs.map((m:any,i:number)=>{const done=milestoneCompleted.includes(m.views);const progress=Math.min(100,Math.round((milestoneViews/m.views)*100));return <div className={`wallet-milestone-row ${done?"done":""}`} key={`${m.views}-${i}`}><div className="wallet-milestone-copy"><b>{m.views} qualified views</b><small>{done?"Reward unlocked":"₹"+m.reward+" bonus"}</small></div><div className="wallet-milestone-progress"><div><i style={{width:`${progress}%`}}/></div><small>{Math.min(milestoneViews,m.views)}/{m.views}</small></div><strong>₹{m.reward}</strong></div>})}</div> : <div className="wallet-milestone-complete">No milestones configured yet.</div>}
          <div className="wallet-milestone-total">Current qualified views: <b>{milestoneViews}</b></div>
        </section>}
        <section id="wallet-history" className="wallet-history-card"><div className="wallet-section-head"><div><h2>Withdrawal history</h2><p>Wallet activity and payout requests.</p></div><button type="button" onClick={loadTransactions} disabled={loadingTransactions}><RefreshCw size={14} className={loadingTransactions?"wallet-spin":""}/> REFRESH</button></div><div className="wallet-filters">{(["all","earning","spend","withdrawal"] as Filter[]).map((item)=><button key={item} type="button" className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item==="all"?"All":item==="earning"?"Earnings":item==="spend"?"Spends":"Withdrawals"}</button>)}</div>{loadingTransactions?<div className="wallet-empty">Loading wallet activity...</div>:filteredTransactions.length===0?<div className="wallet-empty"><History size={23}/><b>No withdrawals yet.</b><span>Your wallet activity will appear here.</span></div>:<div className="wallet-transactions">{filteredTransactions.map((tx)=>{const credit=isCredit(tx.type);return <div className="wallet-transaction" key={tx.id}><div className={`wallet-tx-icon ${credit?"credit":"debit"}`}>{credit?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</div><div className="wallet-tx-main"><b>{typeLabel(tx.type)}</b><span>{tx.description||"Wallet transaction"}</span><small>{formatDate(tx.createdAt)}</small></div><div className="wallet-tx-amount"><strong className={credit?"credit-text":"debit-text"}>{credit?"+":"-"}{Math.abs(Number(tx.coins||0)).toLocaleString()}</strong><small>{Number(tx.balanceAfter||0).toLocaleString()} balance</small></div></div>})}</div>}</section>
        <section className="wallet-how-card"><h2><CheckCircle2 size={19}/> How rewards work</h2><p><IndianRupee size={18}/> Earn from valid watch activity using the existing reward rules.</p><p><History size={18}/> Watch time must satisfy the campaign's required qualification.</p><p><span className="wallet-alert">!</span> Invalid or duplicate activity is not counted by the existing system.</p><p><Coins size={18}/> Minimum withdrawal and payout rules remain unchanged.</p><p><CheckCircle2 size={18}/> Payout requests are reviewed through the existing admin flow.</p></section><div className="wallet-safe-space" aria-hidden="true"/>
      </div>
      {withdrawOpen&&!isPromotion&&<div className="withdraw-overlay" role="dialog" aria-modal="true" aria-label="Withdraw coins"><div className="withdraw-modal"><div className="withdraw-head"><div><h2>Withdraw Coins</h2><p>Convert your available coins into a withdrawal request.</p></div><button type="button" className="withdraw-close" onClick={()=>setWithdrawOpen(false)} aria-label="Close"><X size={19}/></button></div><div className="withdraw-summary"><div><span>Available</span><b>{maxWithdrawCoins.toLocaleString()} coins</b></div><div><span>Request value</span><b>₹{requestedAmount.toFixed(4)}</b></div></div><label>Coins to withdraw<input type="number" min={100} max={Math.max(100,maxWithdrawCoins)} step={1} value={withdrawCoins} onChange={(e)=>setWithdrawCoins(Math.floor(Number(e.target.value||0)))}/></label><div className="withdraw-methods"><button type="button" className={paymentMethod==="UPI"?"active":""} onClick={()=>setPaymentMethod("UPI")}>UPI</button><button type="button" className={paymentMethod==="BANK"?"active":""} onClick={()=>setPaymentMethod("BANK")}>BANK</button></div><label>{paymentMethod==="UPI"?"UPI ID":"Bank / payment details"}<input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} placeholder={paymentMethod==="UPI"?"name@upi":"Enter your payment details"}/></label>{withdrawMessage&&<div className={`withdraw-message ${withdrawMessage.includes("successfully")?"success":"error"}`}>{withdrawMessage.includes("successfully")?<CheckCircle2 size={16}/>:null}<span>{withdrawMessage}</span></div>}<button type="button" className="withdraw-submit" onClick={submitWithdrawal} disabled={withdrawLoading||maxWithdrawCoins<100}>{withdrawLoading?"SUBMITTING...":"REQUEST WITHDRAWAL"}</button><small className="withdraw-note">Minimum withdrawal: 100 coins. Requests are reviewed from the admin panel.</small></div></div>}

      <style>{PAGE_CSS}</style>
    </Layout>
  );
}

function CreatorWalletPage() {
  return (
    <Layout>
      <div className="creator-wallet-page">
        <section className="creator-wallet-heading">
          <div className="creator-wallet-icon"><WalletCards size={22}/></div>
          <div><h1>Campaign Center</h1><p>Create campaigns using the current Admin pricing.</p></div>
        </section>
        <section className="creator-wallet-note-card">
          <CheckCircle2 size={20}/>
          <div>
            <b>No package wallet</b>
            <span>Campaign packages, package balances, creator earnings, withdrawals and payout controls have been removed. Campaign cost is calculated automatically from Admin pricing when you create a campaign.</span>
          </div>
        </section>
        <Link to="/create-campaign" className="creator-create-campaign-link">
          <Plus size={18}/> CREATE CAMPAIGN
        </Link>
      </div>
      <style>{CREATOR_WALLET_CSS}</style>
    </Layout>
  );
}

export default function WalletPage(){
  const {user}=useAuth();
  const isPromotion=user?.role==="creator" || user?.accountType==="promotion";
  return isPromotion ? <CreatorWalletPage/> : <UserWalletPage/>;
}

const CREATOR_WALLET_CSS = String.raw`
.creator-wallet-page{width:min(100%,760px);margin:0 auto;padding:12px;color:#151515}
.creator-wallet-heading{display:flex;align-items:center;gap:12px;margin:4px 0 18px}
.creator-wallet-icon{width:50px;height:50px;border-radius:15px;background:#fff0f0;color:#f00;display:grid;place-items:center}
.creator-wallet-heading h1{margin:0;font-size:29px;font-weight:950}
.creator-wallet-heading p{margin:5px 0 0;color:#777;font-size:11px}
.creator-wallet-note-card{display:flex;gap:12px;align-items:flex-start;padding:17px;border:1px solid #e7e7e7;border-radius:15px;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.04)}
.creator-wallet-note-card>svg{color:#079447;flex:none;margin-top:2px}
.creator-wallet-note-card b,.creator-wallet-note-card span{display:block}
.creator-wallet-note-card b{font-size:13px}
.creator-wallet-note-card span{margin-top:5px;color:#777;font-size:10px;line-height:1.55}
.creator-create-campaign-link{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:12px;height:46px;border-radius:11px;background:#f00;color:#fff;text-decoration:none;font-size:11px;font-weight:950}
`;
