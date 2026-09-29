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

export default function WalletPage() {
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
          <div className="wallet-kpi"><span>Wallet Balance</span><strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong><small>available earnings</small><i><IndianRupee size={17}/></i></div>
          <div className="wallet-kpi"><span>Available Coins</span><strong>{Number(wallet.coins || 0).toLocaleString()}</strong><small>current balance</small><i><Coins size={17}/></i></div>
          <div className="wallet-kpi"><span>Viewer Earnings</span><strong>₹{Number(wallet.earnings || 0).toFixed(2)}</strong><small>lifetime earned</small><i><Sparkles size={17}/></i></div>
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

const PAGE_CSS = String.raw`
.wallet-page{width:min(100%,760px);margin:0 auto;padding:12px 0 38px;color:#151515;background:#fff;box-sizing:border-box}.wallet-heading{display:flex;align-items:center;gap:13px;margin:0 4px 18px}.wallet-heading-icon{width:48px;height:48px;border-radius:15px;background:linear-gradient(145deg,#fff1f1,#ffe5e5);color:#ff0000;display:grid;place-items:center;box-shadow:0 4px 14px rgba(255,0,0,.08)}.wallet-heading h1{margin:0;font-size:30px;line-height:1;font-weight:950;letter-spacing:-.5px}.wallet-heading p{margin:6px 0 0;color:#777;font-size:11px}.wallet-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.wallet-kpi{position:relative;min-height:122px;padding:16px 15px;border:1px solid #e6e6e6;border-radius:19px;background:#fff;box-sizing:border-box;box-shadow:0 5px 18px rgba(0,0,0,.035);overflow:hidden}.wallet-kpi:after{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:#ff0000;border-radius:19px 0 0 19px}.wallet-kpi span,.wallet-kpi small{display:block;color:#777}.wallet-kpi span{font-size:11px;font-weight:700;padding-right:40px}.wallet-kpi small{margin-top:7px;font-size:9px}.wallet-kpi strong{display:block;margin-top:16px;color:#ff0000;font-size:24px;line-height:1;font-weight:950;letter-spacing:-.3px}.wallet-kpi i{position:absolute;right:13px;top:13px;width:39px;height:39px;border-radius:50%;background:#fff0f0;color:#ff0000;display:grid;place-items:center;font-style:normal}.wallet-summary{margin-top:22px}.wallet-summary-title{display:flex;align-items:center;justify-content:space-between;margin:0 3px 11px}.wallet-summary-title h2{margin:0;font-size:19px;font-weight:950;letter-spacing:-.2px}.wallet-summary-title span{font-size:10px;color:#777;white-space:nowrap}.wallet-summary-title b{display:inline-block;width:9px;height:9px;border-radius:50%;background:#13b86b;margin-right:5px}.wallet-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.wallet-summary-grid>div{position:relative;min-height:98px;padding:15px;border:1px solid #e6e6e6;border-radius:17px;background:#fff;box-sizing:border-box;box-shadow:0 5px 16px rgba(0,0,0,.03)}.wallet-summary-grid span{display:block;color:#777;font-size:10px;font-weight:600}.wallet-summary-grid strong{display:block;margin-top:21px;color:#ff0000;font-size:21px;line-height:1;font-weight:950}.wallet-summary-grid i{position:absolute;right:11px;top:11px;width:34px;height:34px;border-radius:50%;background:#f7f7f7;color:#ff0000;display:grid;place-items:center;font-style:normal}.wallet-viewer-card{margin-top:22px;padding:18px;border:1px solid #e4e4e4;border-radius:20px;background:linear-gradient(145deg,#fff,#fffafa);box-shadow:0 8px 24px rgba(0,0,0,.045)}.wallet-viewer-head{display:flex;align-items:center;gap:9px;color:#ff0000}.wallet-viewer-head h2{margin:0;color:#222;font-size:19px;font-weight:900}.wallet-available-label{display:block;margin-top:8px;color:#888;font-size:10px}.wallet-available{display:block;margin-top:3px;color:#08a866;font-size:40px;line-height:1;font-weight:950;letter-spacing:-.8px}.wallet-viewer-stats{display:flex;flex-wrap:wrap;gap:10px 20px;margin-top:18px;color:#777;font-size:11px}.wallet-viewer-stats b{color:#ff9d00}.wallet-viewer-stats span:last-child b{color:#2478df}.wallet-viewer-stats strong{color:#222}.wallet-withdraw-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:300px;max-width:100%;height:52px;margin-top:19px;border:0;border-radius:12px;background:#ff0000;color:#fff;text-decoration:none;font-size:14px;font-weight:950;cursor:pointer;box-sizing:border-box;box-shadow:0 6px 14px rgba(255,0,0,.18)}.wallet-withdraw-btn:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}.wallet-withdraw-note{display:block;margin-top:9px;color:#777;text-align:center;font-size:10px}.wallet-withdraw-help{margin-top:9px;color:#777;font-size:10px;text-align:center}.wallet-history-card{margin-top:22px;padding:18px;border:1px solid #e4e4e4;border-radius:20px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.035)}.wallet-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.wallet-section-head h2{margin:0;font-size:18px;font-weight:950}.wallet-section-head p{margin:5px 0 0;color:#999;font-size:10px}.wallet-section-head button{display:flex;align-items:center;gap:4px;border:1px solid #ffc5c5;border-radius:9px;background:#fff7f7;color:#ff0000;padding:8px 10px;font-size:8px;font-weight:900}.wallet-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:13px 0}.wallet-filters button{border:1px solid #eee;border-radius:9px;padding:9px 3px;background:#fafafa;color:#666;font-size:8px;font-weight:900}.wallet-filters button.active{border-color:#ff0000;background:#ff0000;color:#fff}.wallet-transactions{display:grid}.wallet-transaction{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px 0;border-bottom:1px solid #eee}.wallet-transaction:last-child{border-bottom:0}.wallet-tx-icon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center}.wallet-tx-icon.credit{background:#ecfff4;color:#078b43}.wallet-tx-icon.debit{background:#fff0f0;color:#d92828}.wallet-tx-main{min-width:0}.wallet-tx-main b,.wallet-tx-main span,.wallet-tx-main small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wallet-tx-main b{font-size:10px}.wallet-tx-main span{margin-top:3px;color:#777;font-size:8px}.wallet-tx-main small{margin-top:3px;color:#aaa;font-size:7px}.wallet-tx-amount{text-align:right}.wallet-tx-amount strong{display:block;font-size:10px}.wallet-tx-amount small{display:block;margin-top:2px;color:#aaa;font-size:7px}.credit-text{color:#078b43}.debit-text{color:#d92828}.wallet-empty{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#aaa;text-align:center;font-size:9px}.wallet-empty b{font-size:12px;color:#777}.wallet-how-card{margin-top:22px;padding:18px;border:1px solid #e4e4e4;border-radius:20px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.035)}.wallet-how-card h2{display:flex;align-items:center;gap:8px;margin:0 0 15px;font-size:18px}.wallet-how-card p{display:flex;align-items:flex-start;gap:10px;margin:13px 0;color:#777;font-size:11px;line-height:1.5}.wallet-how-card p svg{flex:none;color:#ff0000}.wallet-alert{width:18px;height:18px;display:grid;place-items:center;flex:none;border-radius:50%;background:#fff0f0;color:#ff0000;font-weight:950}.wallet-safe-space{height:14px}.wallet-spin{animation:walletSpin .8s linear infinite}@keyframes walletSpin{to{transform:rotate(360deg)}}
.withdraw-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:center;padding:14px;background:rgba(0,0,0,.45)}.withdraw-modal{width:min(100%,460px);padding:18px;border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.22);box-sizing:border-box}.withdraw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.withdraw-head h2{margin:0;font-size:20px;font-weight:950}.withdraw-head p{margin:4px 0 0;color:#888;font-size:9px}.withdraw-close{width:34px;height:34px;border:0;border-radius:9px;background:#f5f5f5;color:#666;display:grid;place-items:center}.withdraw-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.withdraw-summary>div{padding:11px;border-radius:11px;background:#fff4f4}.withdraw-summary span,.withdraw-summary b{display:block}.withdraw-summary span{font-size:8px;color:#888}.withdraw-summary b{margin-top:3px;font-size:12px;color:#ff0000}.withdraw-modal label{display:block;margin-top:10px;font-size:9px;font-weight:900}.withdraw-modal input{width:100%;height:40px;margin-top:5px;padding:0 11px;border:1px solid #ddd;border-radius:9px;box-sizing:border-box;font-size:12px}.withdraw-methods{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.withdraw-methods button{height:35px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#666;font-size:9px;font-weight:900}.withdraw-methods button.active{border-color:#ff0000;background:#fff0f0;color:#ff0000}.withdraw-message{display:flex;align-items:center;gap:6px;margin-top:10px;padding:9px;border-radius:9px;font-size:9px}.withdraw-message.success{background:#ecfff4;color:#078b43}.withdraw-message.error{background:#fff0f0;color:#d92828}.withdraw-submit{width:100%;height:44px;margin-top:13px;border:0;border-radius:10px;background:#ff0000;color:#fff;font-size:10px;font-weight:950}.withdraw-submit:disabled{opacity:.55}.withdraw-note{display:block;margin-top:8px;color:#999;text-align:center;font-size:7px}
@media(max-width:600px){.wallet-page{width:100%;padding:7px 0 28px}.wallet-heading{margin-bottom:16px}.wallet-heading h1{font-size:27px}.wallet-kpi{min-height:112px;padding:15px}.wallet-kpi strong{font-size:22px}.wallet-summary-grid>div{min-height:92px}.wallet-viewer-card,.wallet-history-card,.wallet-how-card{border-radius:17px}.wallet-available{font-size:36px}.wallet-withdraw-btn{width:100%}}
@media(max-width:430px){.wallet-kpi-grid,.wallet-summary-grid{gap:8px}.wallet-kpi{min-height:104px;padding:13px}.wallet-kpi span{font-size:9px}.wallet-kpi strong{font-size:20px;margin-top:14px}.wallet-kpi small{font-size:8px}.wallet-kpi i{width:35px;height:35px;right:10px;top:10px}.wallet-summary-title h2{font-size:18px}.wallet-summary-grid>div{min-height:88px;padding:13px}.wallet-summary-grid strong{font-size:19px;margin-top:19px}.wallet-viewer-card,.wallet-history-card,.wallet-how-card{padding:15px}.wallet-available{font-size:34px}.wallet-how-card p{font-size:10px}}
`;

