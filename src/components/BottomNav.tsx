import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Plus, UserCircle, Wallet, Megaphone, ShieldCheck, Video, PlaySquare, Radio, type LucideIcon } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
};

export default function BottomNav() {
  const { user } = useAuth();

  const earningItems: NavItem[] = [
    { to: "/video", label: "VIDEO", icon: Video },
    { to: "/shorts", label: "SHORTS", icon: PlaySquare },
    { to: "/live", label: "LIVE", icon: Radio },
    { to: "/wallet", label: "WALLET", icon: Wallet },
    { to: "/profile", label: "PROFILE", icon: UserCircle },
  ];

  const promotionItems: NavItem[] = [
    { to: "/campaigns", label: "CAMPAIGNS", icon: Megaphone },
    { to: "/create-campaign", label: "CREATE", icon: Plus, accent: true },
    { to: "/wallet", label: "WALLET", icon: Wallet },
    { to: "/profile", label: "PROFILE", icon: UserCircle },
  ];

  if (user?.role === "admin") {
    promotionItems.push({ to: "/admin", label: "ADMIN", icon: ShieldCheck });
  }

  const items = user?.role === "admin" || user?.role === "creator" || user?.accountType === "promotion" ? promotionItems : earningItems;

  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "BOTTOM_NAV_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <nav className={`bottom-nav ${user?.role === "admin" || user?.role === "creator" || user?.accountType === "promotion" ? "promotion-nav" : "earning-nav"}`} aria-label="Primary navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `bottom-nav-item ${item.accent ? "create-nav" : ""} ${isActive ? "active" : ""}`
            }
            aria-label={item.label}
          >
            <span className="bottom-nav-icon-wrap">
              <Icon size={21} strokeWidth={2.25} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

const PAGE_CSS = String.raw`
.bottom-nav{
  position:fixed;
  left:50%;
  bottom:0;
  transform:translateX(-50%);
  width:min(100%,960px);
  min-height:76px;
  padding:7px 8px calc(7px + env(safe-area-inset-bottom));
  box-sizing:border-box;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  align-items:center;
  gap:5px;
  background:rgba(255,255,255,.98);
  border-top:1px solid #e8e8e8;
  box-shadow:0 -7px 24px rgba(0,0,0,.07);
  z-index:1000;
  -webkit-backdrop-filter:blur(12px);
  backdrop-filter:blur(12px);
}
.bottom-nav.promotion-nav{grid-template-columns:repeat(4,1fr)}
.bottom-nav.earning-nav{grid-template-columns:repeat(5,1fr);}
.bottom-nav.earning-nav .create-nav .bottom-nav-icon-wrap{width:40px;height:40px;margin-top:0;border-radius:12px;background:#FF0000;color:#fff;border:0;box-shadow:none;}
.bottom-nav.earning-nav .create-nav.active .bottom-nav-icon-wrap{background:#FF0000;color:#fff;}
.bottom-nav.promotion-nav .create-nav{
  color:#FF0000;
}
.bottom-nav-item{
  min-width:0;
  min-height:62px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:4px;
  color:#777;
  text-decoration:none;
  border-radius:13px;
  font-size:8.5px;
  line-height:1;
  font-weight:900;
  letter-spacing:.15px;
  transition:color .16s ease,background .16s ease,transform .16s ease;
}
.bottom-nav-item.active{
  color:#FF0000;
  background:#fff1f1;
}
.bottom-nav-item:active{transform:translateY(1px)}
.bottom-nav-icon-wrap{
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border-radius:10px;
}
.bottom-nav-item.active .bottom-nav-icon-wrap{
  background:#ffe5e5;
}
.bottom-nav.promotion-nav .create-nav .bottom-nav-icon-wrap{
  width:42px;
  height:42px;
  margin-top:-13px;
  border-radius:50%;
  background:#FF0000;
  color:#fff;
  border:4px solid #fff;
  box-shadow:0 5px 16px rgba(255,0,0,.24);
}
.bottom-nav.promotion-nav .create-nav.active .bottom-nav-icon-wrap{background:#FF0000;color:#fff}
.bottom-nav.promotion-nav .create-nav span:last-child{margin-top:-1px}
@media(max-width:700px){
  .bottom-nav{min-height:74px;padding-left:4px;padding-right:4px}
  .bottom-nav-item{min-height:58px;font-size:8px}
  .bottom-nav-icon-wrap{width:34px;height:34px}
  .bottom-nav.promotion-nav .create-nav .bottom-nav-icon-wrap{width:40px;height:40px;margin-top:-12px}
}
@media(max-width:380px){
  .bottom-nav-item{font-size:7px;gap:3px}
  .bottom-nav-icon-wrap{width:32px;height:32px}
  .bottom-nav.promotion-nav .create-nav .bottom-nav-icon-wrap{width:38px;height:38px}
}
`;
