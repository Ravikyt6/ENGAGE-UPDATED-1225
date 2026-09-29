import React from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
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

  React.useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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
        <section className="wallet-summary"><div className="wallet-summary-title"><h2>Quick Rewards Summary</h2><span><b></b> Live</span></div><div className="wallet-summary-grid">
          <div><span>Today</span><strong>₹{todayEarnings.toFixed(2)}</strong><i><History size={16}/></i></div><div><span>Yesterday</span><strong>₹0.00</strong><i><History size={16}/></i></div><div><span>This Month</span><strong>₹{monthEarnings.toFixed(2)}</strong><i><History size={16}/></i></div><div><span>Last Month</span><strong>₹0.00</strong><i><History size={16}/></i></div><div><span>Lifetime</span><strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong><i><Sparkles size={16}/></i></div>
        </div></section>
        <section className="wallet-viewer-card"><div className="wallet-viewer-head"><WalletCards size={21}/><h2>{isPromotion ? "Campaign Wallet" : "Viewer Wallet"}</h2></div><span className="wallet-available-label">Available Balance</span><strong className="wallet-available">₹{Number(wallet.earnings || 0).toFixed(2)}</strong><div className="wallet-viewer-stats"><span><b>◷</b> On Hold: <strong>₹0.00</strong></span><span><b>✓</b> Lifetime Earned: <strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong></span></div>{!isPromotion?<button type="button" className="wallet-withdraw-btn" onClick={openWithdraw} disabled={maxWithdrawCoins<100}><IndianRupee size={17}/> Withdraw</button>:<Link to="/create-campaign" className="wallet-withdraw-btn campaign-link"><Plus size={17}/> Create Campaign</Link>}<div className="wallet-withdraw-note">Minimum withdrawal: ₹20.00</div>{!isPromotion&&<div className="wallet-withdraw-help">{maxWithdrawCoins>=100?"You can request a withdrawal from your available coins.":"You need at least ₹20.00 to withdraw."}</div>}</section>
        <section id="wallet-history" className="wallet-history-card"><div className="wallet-section-head"><div><h2>Withdrawal history</h2><p>Wallet activity and payout requests.</p></div><button type="button" onClick={loadTransactions} disabled={loadingTransactions}><RefreshCw size={14} className={loadingTransactions?"wallet-spin":""}/> REFRESH</button></div><div className="wallet-filters">{(["all","earning","spend","withdrawal"] as Filter[]).map((item)=><button key={item} type="button" className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item==="all"?"All":item==="earning"?"Earnings":item==="spend"?"Spends":"Withdrawals"}</button>)}</div>{loadingTransactions?<div className="wallet-empty">Loading wallet activity...</div>:filteredTransactions.length===0?<div className="wallet-empty"><History size={23}/><b>No withdrawals yet.</b><span>Your wallet activity will appear here.</span></div>:<div className="wallet-transactions">{filteredTransactions.map((tx)=>{const credit=isCredit(tx.type);return <div className="wallet-transaction" key={tx.id}><div className={`wallet-tx-icon ${credit?"credit":"debit"}`}>{credit?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</div><div className="wallet-tx-main"><b>{typeLabel(tx.type)}</b><span>{tx.description||"Wallet transaction"}</span><small>{formatDate(tx.createdAt)}</small></div><div className="wallet-tx-amount"><strong className={credit?"credit-text":"debit-text"}>{credit?"+":"-"}{Math.abs(Number(tx.coins||0)).toLocaleString()}</strong><small>{Number(tx.balanceAfter||0).toLocaleString()} balance</small></div></div>})}</div>}</section>
        <section className="wallet-how-card"><h2><CheckCircle2 size={19}/> How rewards work</h2><p><IndianRupee size={18}/> Earn from valid watch activity using the existing reward rules.</p><p><History size={18}/> Watch time must satisfy the campaign's required qualification.</p><p><span className="wallet-alert">!</span> Invalid or duplicate activity is not counted by the existing system.</p><p><Coins size={18}/> Minimum withdrawal and payout rules remain unchanged.</p><p><CheckCircle2 size={18}/> Payout requests are reviewed through the existing admin flow.</p></section><div className="wallet-safe-space" aria-hidden="true"/>
      </div>
      {withdrawOpen&&!isPromotion&&<div className="withdraw-overlay" role="dialog" aria-modal="true" aria-label="Withdraw coins"><div className="withdraw-modal"><div className="withdraw-head"><div><h2>Withdraw Coins</h2><p>Convert your available coins into a withdrawal request.</p></div><button type="button" className="withdraw-close" onClick={()=>setWithdrawOpen(false)} aria-label="Close"><X size={19}/></button></div><div className="withdraw-summary"><div><span>Available</span><b>{maxWithdrawCoins.toLocaleString()} coins</b></div><div><span>Request value</span><b>₹{requestedAmount.toFixed(4)}</b></div></div><label>Coins to withdraw<input type="number" min={100} max={Math.max(100,maxWithdrawCoins)} step={1} value={withdrawCoins} onChange={(e)=>setWithdrawCoins(Math.floor(Number(e.target.value||0)))}/></label><div className="withdraw-methods"><button type="button" className={paymentMethod==="UPI"?"active":""} onClick={()=>setPaymentMethod("UPI")}>UPI</button><button type="button" className={paymentMethod==="BANK"?"active":""} onClick={()=>setPaymentMethod("BANK")}>BANK</button></div><label>{paymentMethod==="UPI"?"UPI ID":"Bank / payment details"}<input type="text" value={paymentDetails} onChange={(e)=>setPaymentDetails(e.target.value)} placeholder={paymentMethod==="UPI"?"name@upi":"Enter your payment details"}/></label>{withdrawMessage&&<div className={`withdraw-message ${withdrawMessage.includes("successfully")?"success":"error"}`}>{withdrawMessage.includes("successfully")?<CheckCircle2 size={16}/>:null}<span>{withdrawMessage}</span></div>}<button type="button" className="withdraw-submit" onClick={submitWithdrawal} disabled={withdrawLoading||maxWithdrawCoins<100}>{withdrawLoading?"SUBMITTING...":"REQUEST WITHDRAWAL"}</button><small className="withdraw-note">Minimum withdrawal: 100 coins. Requests are reviewed from the admin panel.</small></div></div>}

      <style>{PAGE_CSS}</style>
    </Layout>
  );
}

function CreatorWalletPage(){
  const { user } = useAuth();
  const data = useData();
  const wallet = data.wallet || { coins: 0, earnings: 0 };
  const [transactions,setTransactions]=React.useState<WalletTransaction[]>([]);
  const [loading,setLoading]=React.useState(true);
  const load=React.useCallback(async()=>{
    if(!user?.id)return;
    setLoading(true);
    try{ setTransactions((await data.getWalletTransactions(user.id)||[]) as WalletTransaction[]); }
    catch(e){ console.error("Creator wallet load failed:",e); setTransactions([]); }
    finally{ setLoading(false); }
  },[data,user?.id]);
  React.useEffect(()=>{void load()},[load]);
  const spent=transactions.filter(t=>t.type==="spend").reduce((n,t)=>n+Math.abs(Number(t.coins||0)),0);
  const refunded=transactions.filter(t=>t.type==="refund").reduce((n,t)=>n+Math.abs(Number(t.coins||0)),0);
  const formatDate=(v:string)=>new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
  const rows=transactions.filter(t=>t.type==="spend"||t.type==="refund"||t.type==="admin_adjustment");
  return <Layout>
    <div className="creator-wallet-page">
      <section className="creator-wallet-heading"><div className="creator-wallet-icon"><WalletCards size={22}/></div><div><h1>Campaign Wallet</h1><p>Coins used only for creating and promoting campaigns.</p></div></section>
      <section className="creator-wallet-hero"><div><span>AVAILABLE CAMPAIGN COINS</span><strong>{Number(wallet.coins||0).toLocaleString()}</strong><small>Ready to spend on campaigns</small></div><div className="creator-wallet-coin-icon"><Coins size={24}/></div></section>
      <section className="creator-wallet-stats"><div><span>CAMPAIGN SPENT</span><strong>{spent.toLocaleString()}</strong><small>coins used</small></div><div><span>REFUNDED</span><strong>{refunded.toLocaleString()}</strong><small>unused campaign coins</small></div></section>
      <Link to="/create-campaign" className="creator-wallet-create"><Plus size={18}/> CREATE CAMPAIGN</Link>
      <section className="creator-wallet-history"><div className="creator-wallet-history-head"><div><h2>Campaign Wallet Activity</h2><p>Only campaign coin transactions are shown.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading?"wallet-spin":""}/> REFRESH</button></div>
      {loading?<div className="wallet-empty">Loading campaign wallet...</div>:rows.length===0?<div className="wallet-empty"><Coins size={23}/><b>No campaign transactions yet.</b><span>Create a campaign to start using your campaign wallet.</span></div>:<div className="wallet-transactions">{rows.map(tx=>{const credit=tx.type!=="spend";return <div className="wallet-transaction" key={tx.id}><div className={`wallet-tx-icon ${credit?"credit":"debit"}`}>{credit?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</div><div className="wallet-tx-main"><b>{tx.type==="spend"?"Campaign Spend":tx.type==="refund"?"Campaign Refund":"Balance Adjustment"}</b><span>{tx.description||"Campaign wallet transaction"}</span><small>{formatDate(tx.createdAt)}</small></div><div className="wallet-tx-amount"><strong className={credit?"credit-text":"debit-text"}>{credit?"+":"-"}{Math.abs(Number(tx.coins||0)).toLocaleString()}</strong><small>{Number(tx.balanceAfter||0).toLocaleString()} balance</small></div></div>})}</div>}
      </section>
      <section className="creator-wallet-note"><CheckCircle2 size={18}/><div><b>Creator wallet only</b><span>No viewer earnings, INR balance, withdrawal, or payout controls are available on creator accounts.</span></div></section>
    </div>
    <style>{CREATOR_WALLET_CSS}</style>
  </Layout>
}

export default function WalletPage(){
  const {user}=useAuth();
  const isPromotion=user?.role==="creator" || user?.accountType==="promotion";
  return isPromotion ? <CreatorWalletPage/> : <UserWalletPage/>;
}

const CREATOR_WALLET_CSS = String.raw`
.creator-wallet-page{width:min(100%,780px);margin:0 auto;padding:8px 10px 34px;color:#151515}.creator-wallet-heading{display:flex;align-items:center;gap:12px;margin:2px 2px 18px}.creator-wallet-icon{width:52px;height:52px;border-radius:16px;background:#fff0f0;color:#f00;display:grid;place-items:center}.creator-wallet-heading h1{margin:0;font-size:30px;line-height:1;font-weight:950;letter-spacing:-.7px}.creator-wallet-heading p{margin:6px 0 0;color:#777;font-size:12px}.creator-wallet-hero{display:flex;align-items:center;justify-content:space-between;padding:22px 18px;border:1px solid #eee;border-top:3px solid #f00;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.05)}.creator-wallet-hero span{display:block;color:#666;font-size:11px;font-weight:900}.creator-wallet-hero strong{display:block;margin-top:10px;color:#f00;font-size:34px;line-height:1;font-weight:950}.creator-wallet-hero small{display:block;margin-top:8px;color:#999;font-size:10px}.creator-wallet-coin-icon{width:52px;height:52px;border-radius:16px;background:#fff0f0;color:#f00;display:grid;place-items:center}.creator-wallet-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.creator-wallet-stats>div{padding:16px;border:1px solid #eee;border-radius:16px;background:#fff}.creator-wallet-stats span{display:block;color:#777;font-size:10px;font-weight:900}.creator-wallet-stats strong{display:block;margin-top:11px;font-size:22px;color:#f00}.creator-wallet-stats small{color:#999;font-size:9px}.creator-wallet-create{height:48px;margin-top:14px;border-radius:11px;background:#f00;color:#fff;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:950}.creator-wallet-history{margin-top:18px;border:1px solid #eee;border-radius:18px;background:#fff;padding:16px}.creator-wallet-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.creator-wallet-history-head h2{margin:0;font-size:18px;font-weight:950}.creator-wallet-history-head p{margin:5px 0 0;color:#888;font-size:10px}.creator-wallet-history-head button{height:34px;padding:0 10px;border:1px solid #ddd;border-radius:8px;background:#fff;display:flex;align-items:center;gap:5px;font-size:9px;font-weight:900}.creator-wallet-note{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding:14px;border-radius:13px;background:#f7fff9;color:#168447}.creator-wallet-note b{display:block;font-size:11px}.creator-wallet-note span{display:block;margin-top:3px;color:#666;font-size:10px;line-height:1.45}@media(max-width:600px){.creator-wallet-page{padding-left:7px;padding-right:7px}.creator-wallet-heading h1{font-size:28px}.creator-wallet-heading p{font-size:11px}.creator-wallet-hero{padding:20px 15px}.creator-wallet-hero strong{font-size:31px}.creator-wallet-stats strong{font-size:20px}}
`;

const PAGE_CSS = String.raw`
.wallet-page{width:min(100%,780px);margin:0 auto;padding:14px 10px 34px;color:#151515;background:#fff;box-sizing:border-box}
.wallet-heading{display:flex;align-items:center;gap:12px;margin:2px 2px 18px}
.wallet-heading-icon{width:50px;height:50px;border-radius:16px;background:#fff0f0;color:#f00;display:grid;place-items:center;box-shadow:0 5px 16px rgba(255,0,0,.09)}
.wallet-heading h1{margin:0;font-size:29px;line-height:1;font-weight:950;letter-spacing:-.7px}
.wallet-heading p{margin:6px 0 0;color:#777;font-size:11px}

.wallet-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wallet-kpi{position:relative;min-height:128px;padding:17px 15px;border:1px solid #e9e9e9;border-radius:20px;background:linear-gradient(145deg,#fff,#fffafa);box-sizing:border-box;box-shadow:0 7px 22px rgba(0,0,0,.045);overflow:hidden}
.wallet-kpi:before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:#f00}
.wallet-kpi span{display:block;color:#666;font-size:10px;font-weight:800;padding-right:46px}
.wallet-kpi small{display:block;margin-top:7px;color:#999;font-size:8px}
.wallet-kpi strong{display:block;margin-top:17px;color:#f00;font-size:24px;line-height:1;font-weight:950;letter-spacing:-.5px}
.wallet-kpi i{position:absolute;right:12px;top:13px;width:40px;height:40px;border-radius:13px;background:#fff0f0;color:#f00;display:grid;place-items:center;font-style:normal}
.wallet-kpi:nth-child(2) strong{color:#f00}.wallet-kpi:nth-child(3) strong{color:#f00}.wallet-kpi:nth-child(4) strong{color:#0aaa68}
.wallet-kpi:nth-child(4) i{background:#ecfff6;color:#0aaa68}

.wallet-summary{margin-top:24px}
.wallet-summary-title{display:flex;align-items:center;justify-content:space-between;margin:0 3px 11px}
.wallet-summary-title h2{margin:0;font-size:20px;font-weight:950;letter-spacing:-.4px}
.wallet-summary-title span{font-size:10px;color:#777;font-weight:700}
.wallet-summary-title b{display:inline-block;width:9px;height:9px;border-radius:50%;background:#11b66c;margin-right:5px}
.wallet-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.wallet-summary-grid>div{position:relative;min-height:100px;padding:15px;border:1px solid #e9e9e9;border-radius:18px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.035);box-sizing:border-box}
.wallet-summary-grid span{display:block;color:#777;font-size:10px;font-weight:700}
.wallet-summary-grid strong{display:block;margin-top:22px;color:#f00;font-size:22px;line-height:1;font-weight:950}
.wallet-summary-grid i{position:absolute;right:11px;top:11px;width:35px;height:35px;border-radius:12px;background:#f7f7f7;color:#f00;display:grid;place-items:center;font-style:normal}

.wallet-viewer-card{position:relative;margin-top:22px;padding:20px;border:1px solid #e5e5e5;border-radius:22px;background:linear-gradient(145deg,#171717,#0d0d0d);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.12);overflow:hidden}
.wallet-viewer-card:after{content:"";position:absolute;width:170px;height:170px;right:-70px;top:-80px;border-radius:50%;background:rgba(255,0,0,.16);filter:blur(3px)}
.wallet-viewer-head{position:relative;z-index:1;display:flex;align-items:center;gap:9px;color:#ff3b3b}
.wallet-viewer-head h2{margin:0;color:#fff;font-size:19px;font-weight:900}
.wallet-available-label{position:relative;z-index:1;display:block;margin-top:12px;color:#aaa;font-size:10px}
.wallet-available{position:relative;z-index:1;display:block;margin-top:4px;color:#19d17d;font-size:40px;line-height:1;font-weight:950;letter-spacing:-1px}
.wallet-viewer-stats{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:18px;color:#aaa;font-size:11px}
.wallet-viewer-stats b{color:#ffb000}.wallet-viewer-stats span:last-child b{color:#4b91ff}.wallet-viewer-stats strong{color:#eee}
.wallet-withdraw-btn{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:7px;width:300px;max-width:100%;height:50px;margin-top:20px;border:0;border-radius:13px;background:#f00;color:#fff;text-decoration:none;font-size:14px;font-weight:950;cursor:pointer;box-sizing:border-box;box-shadow:0 7px 18px rgba(255,0,0,.2)}
.wallet-withdraw-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.wallet-withdraw-note{position:relative;z-index:1;display:block;margin-top:9px;color:#aaa;text-align:center;font-size:10px}
.wallet-withdraw-help{position:relative;z-index:1;margin-top:7px;color:#aaa;font-size:10px;text-align:center}

.wallet-history-card{margin-top:22px;padding:19px;border:1px solid #e6e6e6;border-radius:22px;background:#fff;box-shadow:0 7px 22px rgba(0,0,0,.035)}
.wallet-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.wallet-section-head h2{margin:0;font-size:18px;font-weight:950}
.wallet-section-head p{margin:5px 0 0;color:#999;font-size:10px}
.wallet-section-head button{display:flex;align-items:center;gap:5px;border:1px solid #ffd0d0;border-radius:10px;background:#fff7f7;color:#f00;padding:8px 10px;font-size:8px;font-weight:900}
.wallet-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:14px 0}
.wallet-filters button{border:1px solid #eee;border-radius:10px;padding:9px 3px;background:#fafafa;color:#666;font-size:8px;font-weight:900}
.wallet-filters button.active{border-color:#f00;background:#f00;color:#fff}
.wallet-transactions{display:grid}
.wallet-transaction{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #eee}
.wallet-transaction:last-child{border-bottom:0}
.wallet-tx-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center}
.wallet-tx-icon.credit{background:#ecfff5;color:#078b43}.wallet-tx-icon.debit{background:#fff0f0;color:#d92828}
.wallet-tx-main{min-width:0}.wallet-tx-main b,.wallet-tx-main span,.wallet-tx-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wallet-tx-main b{font-size:10px}.wallet-tx-main span{margin-top:3px;color:#777;font-size:8px}.wallet-tx-main small{margin-top:3px;color:#aaa;font-size:7px}
.wallet-tx-amount{text-align:right}.wallet-tx-amount strong{display:block;font-size:10px}.wallet-tx-amount small{display:block;margin-top:2px;color:#aaa;font-size:7px}
.credit-text{color:#078b43}.debit-text{color:#d92828}
.wallet-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#aaa;text-align:center;font-size:9px}.wallet-empty b{font-size:12px;color:#777}

.wallet-how-card{margin-top:22px;padding:20px;border:1px solid #e6e6e6;border-radius:22px;background:#fff;box-shadow:0 7px 22px rgba(0,0,0,.035)}
.wallet-how-card h2{display:flex;align-items:center;gap:8px;margin:0 0 15px;font-size:18px}.wallet-how-card p{display:flex;align-items:flex-start;gap:10px;margin:13px 0;color:#777;font-size:11px;line-height:1.5}.wallet-how-card p svg{flex:none;color:#f00}
.wallet-alert{width:18px;height:18px;display:grid;place-items:center;flex:none;border-radius:50%;background:#fff0f0;color:#f00;font-weight:950}
.wallet-safe-space{height:18px}.wallet-spin{animation:walletSpin .8s linear infinite}@keyframes walletSpin{to{transform:rotate(360deg)}}

.withdraw-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:center;padding:14px;background:rgba(0,0,0,.5)}
.withdraw-modal{width:min(100%,460px);padding:19px;border-radius:22px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25);box-sizing:border-box}
.withdraw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.withdraw-head h2{margin:0;font-size:20px;font-weight:950}.withdraw-head p{margin:4px 0 0;color:#888;font-size:9px}
.withdraw-close{width:34px;height:34px;border:0;border-radius:10px;background:#f5f5f5;color:#666;display:grid;place-items:center}
.withdraw-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.withdraw-summary>div{padding:12px;border:1px solid #eee;border-radius:12px;background:#fafafa}.withdraw-summary span,.withdraw-summary b{display:block}.withdraw-summary span{font-size:8px;color:#999}.withdraw-summary b{margin-top:5px;font-size:12px}
.withdraw-modal label{display:block;margin-top:12px;font-size:9px;font-weight:800;color:#555}.withdraw-modal input{display:block;width:100%;height:44px;margin-top:6px;padding:0 12px;border:1px solid #ddd;border-radius:10px;outline:none;box-sizing:border-box}.withdraw-methods{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.withdraw-methods button{height:40px;border:1px solid #ddd;border-radius:10px;background:#fff;font-size:10px;font-weight:900}.withdraw-methods button.active{border-color:#f00;background:#fff0f0;color:#f00}
.withdraw-message{display:flex;align-items:center;gap:7px;margin-top:12px;padding:10px;border-radius:10px;font-size:9px}.withdraw-message.success{background:#ecfff5;color:#078b43}.withdraw-message.error{background:#fff0f0;color:#d92828}
.withdraw-submit{width:100%;height:48px;margin-top:14px;border:0;border-radius:12px;background:#f00;color:#fff;font-weight:950;font-size:11px}.withdraw-submit:disabled{opacity:.5}
.withdraw-note{display:block;margin-top:9px;color:#999;font-size:8px;text-align:center}

@media(max-width:380px){.wallet-page{padding-left:7px;padding-right:7px}.wallet-kpi{min-height:116px;padding:14px 12px}.wallet-kpi strong{font-size:21px}.wallet-kpi i{width:36px;height:36px}.wallet-summary-grid>div{min-height:92px;padding:13px}.wallet-summary-grid strong{font-size:19px}.wallet-viewer-card,.wallet-history-card,.wallet-how-card{padding:16px}}
@media(min-width:700px){.wallet-page{padding-left:0;padding-right:0}.wallet-kpi-grid{gap:14px}.wallet-summary-grid{grid-template-columns:repeat(3,1fr)}.wallet-summary-grid>div:nth-child(4),.wallet-summary-grid>div:nth-child(5){min-height:100px}}
`;


