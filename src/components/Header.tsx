import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Coins, IndianRupee, LogOut } from "lucide-react";

export default function Header(){
  const {user,logout}=useAuth();
  const {db}=useData();
  const wallet=user?db.wallets[user.id]:undefined;
  const balance=wallet?.coins||0;
  const earnings=Number(wallet?.earnings||0);
  const isCreator= user?.role === "creator" || user?.accountType === "promotion";

  return <>
    <header className="topbar">
      <div className="brand" aria-label="ENGAGE">
        <img className="brand-logo" src="/engage-logo.svg" alt="" aria-hidden="true" />
        <span>ENGAGE</span>
      </div>
      <div className="header-actions">
        {!isCreator && <div className="top-earnings" aria-label="Earnings">
          <IndianRupee size={15}/><span>{earnings.toFixed(2)}</span>
        </div>}
        <div className="coin-balance" aria-label="Coins">
          <span className="coin-balance-icon"><Coins size={16}/></span>
          <span>{balance.toLocaleString()}</span>
        </div>
        <button className="logout-mini" onClick={logout} title="Logout" aria-label="Logout">
          <LogOut size={18}/>
        </button>
      </div>
    </header>
    <style>{`
      .topbar{width:100%;height:64px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px;background:#FF0000;color:#fff;position:sticky;top:0;z-index:1000;box-shadow:0 2px 10px rgba(0,0,0,.12)}
      .brand{display:flex;align-items:center;gap:8px;font-size:22px;line-height:1;font-weight:950;letter-spacing:-.7px;white-space:nowrap}.brand-logo{width:31px;height:31px;display:block;flex:0 0 31px;border-radius:9px;object-fit:cover}
      .header-actions{display:flex;align-items:center;gap:2px;min-width:0;margin-left:auto}
      .top-earnings,.coin-balance{height:36px;padding:0 7px;display:flex;align-items:center;gap:4px;color:#fff;border-left:1px solid rgba(255,255,255,.24);font-size:12px;font-weight:900;white-space:nowrap}
      .top-earnings svg{color:#ffd54a}.coin-balance-icon{display:grid;place-items:center;color:#ffd54a}
      .logout-mini{width:36px;height:36px;padding:0;border:0;display:grid;place-items:center;background:transparent;color:#fff;border-radius:9px;cursor:pointer}
      .logout-mini:hover{background:rgba(255,255,255,.13)}
      @media(max-width:480px){.topbar{height:60px;padding:0 10px}.brand{font-size:19px;gap:7px}.brand-logo{width:28px;height:28px;flex-basis:28px;border-radius:8px}.header-actions{gap:0}.top-earnings,.coin-balance{height:34px;font-size:10.5px;padding:0 5px}.top-earnings svg,.coin-balance-icon svg{width:14px;height:14px}.logout-mini{width:31px;height:31px}}
      @media(max-width:360px){.top-earnings{display:none}.brand{font-size:18px;gap:6px}.brand-logo{width:26px;height:26px;flex-basis:26px;border-radius:7px}.coin-balance{font-size:10px}.coin-balance-icon svg{width:13px;height:13px}}
    `}</style>
  </>;
}
