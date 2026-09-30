import { useAuth } from "@/context/AuthContext";
import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);

    return () => style.remove();
  }, []);

  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const navItems = [
    {
      to: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/admin/campaigns",
      label: "Campaigns",
      icon: Megaphone,
    },
    {
      to: "/admin/users",
      label: "Users",
      icon: Users,
    },
    {
      to: "/admin/withdrawals",
      label: "Withdrawals",
      icon: WalletCards,
    },
    {
      to: "/admin/milestones",
      label: "Milestones",
      icon: Trophy,
    },
    {
      to: "/admin/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <div className="admin-shell">

      {/* MOBILE TOPBAR */}
      <header className="admin-mobile-topbar">
        <button
          type="button"
          className="admin-mobile-menu"
          onClick={() => setMenuOpen(true)}
          aria-label="Open admin menu"
        >
          <Menu size={23} />
        </button>

        <div className="admin-mobile-brand">
          ENGAGE <span>ADMIN</span>
        </div>
      </header>

      {/* MOBILE BACKDROP */}
      {menuOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={closeMenu}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`admin-side ${
          menuOpen ? "admin-side-open" : ""
        }`}
      >

        {/* BRAND */}
        <div className="admin-sidebar-head">
          <div className="admin-brand">
            ENGAGE <span>ADMIN</span>
          </div>

          <button
            type="button"
            className="admin-close-btn"
            onClick={closeMenu}
            aria-label="Close admin menu"
          >
            <X size={19} />
          </button>
        </div>

        {/* USER */}
        <div className="admin-user-card">
          <div className="admin-avatar">
            {(user?.name || "A")[0].toUpperCase()}
          </div>

          <div className="admin-user-info">
            <strong>{user?.name || "Administrator"}</strong>
            <span>{user?.email}</span>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="admin-nav">
          <div className="admin-nav-title">
            MENU
          </div>

          {navItems.map(
            ({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/admin"}
                onClick={closeMenu}
              >
                <span className="admin-nav-left">
                  <span className="admin-nav-icon">
                    <Icon
                      size={18}
                      strokeWidth={2.2}
                    />
                  </span>

                  <span>{label}</span>
                </span>
              </NavLink>
            )
          )}
        </nav>

        {/* BOTTOM ACTIONS */}
        <div className="admin-side-bottom">

          <Link
            to="/video"
            onClick={closeMenu}
            className="admin-user-app"
          >
            <span>
              <ExternalLink size={17} />
              User App
            </span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="admin-logout"
          >
            <LogOut size={17} />
            Logout
          </button>

        </div>
      </aside>

      {/* CONTENT */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

/* =========================================================
   ADMIN LAYOUT CSS
   Kept inside AdminLayout.tsx
========================================================= */

const PAGE_CSS = String.raw`

.admin-shell{
  min-height:100vh;
  width:100%;

  background:#f6f6f6;

  display:flex;

  color:#222;

  overflow-x:hidden;
}


/* =========================================================
   SIDEBAR
========================================================= */

.admin-side{
  position:fixed;

  top:0;
  left:0;
  bottom:0;

  width:250px;

  box-sizing:border-box;

  padding:20px 14px;

  background:#171717;
  color:#fff;

  z-index:1000;

  display:flex;
  flex-direction:column;

  box-shadow:4px 0 20px rgba(0,0,0,.14);
}


/* =========================================================
   BRAND
========================================================= */

.admin-sidebar-head{
  height:40px;

  display:flex;
  align-items:center;
  justify-content:space-between;

  padding:0 5px;

  margin-bottom:18px;
}

.admin-brand{
  display:flex;
  align-items:center;
  gap:7px;

  color:#fff;

  font-size:22px;
  line-height:1;

  font-weight:950;

  letter-spacing:-.6px;
}

.admin-brand span{
  display:inline-flex;
  align-items:center;

  height:20px;

  padding:0 6px;

  background:#FF0000;
  color:#fff;

  border-radius:5px;

  font-size:8px;
  line-height:1;

  font-weight:900;

  letter-spacing:.2px;
}

.admin-close-btn{
  display:none;
}


/* =========================================================
   USER
========================================================= */

.admin-user-card{
  display:flex;
  align-items:center;

  gap:10px;

  padding:11px;

  margin-bottom:18px;

  background:#222;

  border:1px solid #303030;

  border-radius:11px;
}

.admin-avatar{
  width:38px;
  height:38px;

  flex:0 0 38px;

  display:grid;
  place-items:center;

  border-radius:10px;

  background:#FF0000;

  color:#fff;

  font-size:15px;
  font-weight:950;
}

.admin-user-info{
  min-width:0;

  display:flex;
  flex-direction:column;

  gap:4px;
}

.admin-user-info strong{
  color:#fff;

  font-size:11px;
  font-weight:850;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.admin-user-info span{
  color:#888;

  font-size:8px;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}


/* =========================================================
   NAV
========================================================= */

.admin-nav{
  display:flex;
  flex-direction:column;

  gap:4px;
}

.admin-nav-title{
  padding:5px 10px 8px;

  color:#666;

  font-size:8px;

  font-weight:900;

  letter-spacing:1px;
}

.admin-nav a{
  min-height:47px;

  box-sizing:border-box;

  display:flex;
  align-items:center;

  padding:5px 8px;

  color:#aaa;

  text-decoration:none;

  border:1px solid transparent;

  border-radius:10px;

  font-size:11px;

  font-weight:750;

  transition:
    background .16s ease,
    color .16s ease,
    border-color .16s ease;
}

.admin-nav a:hover{
  background:#222;
  color:#fff;
}

.admin-nav a.active{
  background:#FF0000;
  color:#fff;

  border-color:#FF0000;

  box-shadow:
    0 5px 14px rgba(237,52,52,.18);
}

.admin-nav-left{
  display:flex;
  align-items:center;

  gap:10px;
}

.admin-nav-icon{
  width:34px;
  height:34px;

  flex:0 0 34px;

  display:grid;
  place-items:center;

  background:#222;

  color:#aaa;

  border-radius:8px;

  transition:
    background .16s ease,
    color .16s ease;
}

.admin-nav a.active .admin-nav-icon{
  background:rgba(255,255,255,.16);
  color:#fff;
}

.admin-nav a:hover .admin-nav-icon{
  color:#fff;
}


/* =========================================================
   BOTTOM
========================================================= */

.admin-side-bottom{
  margin-top:auto;

  padding-top:15px;

  border-top:1px solid #2a2a2a;

  display:flex;
  flex-direction:column;

  gap:5px;
}

.admin-user-app,
.admin-logout{
  min-height:43px;

  box-sizing:border-box;

  padding:7px 10px;

  display:flex;
  align-items:center;

  border:0;

  border-radius:9px;

  background:transparent;

  color:#aaa;

  text-decoration:none;

  font-size:11px;

  font-weight:750;

  cursor:pointer;

  transition:
    background .16s ease,
    color .16s ease;
}

.admin-user-app span,
.admin-logout{
  display:flex;
  align-items:center;

  gap:9px;
}

.admin-user-app:hover{
  background:#222;
  color:#fff;
}

.admin-logout:hover{
  background:#351919;
  color:#ff6b6b;
}


/* =========================================================
   MAIN
========================================================= */

.admin-main{
  width:calc(100% - 250px);

  min-height:100vh;

  margin-left:250px;

  box-sizing:border-box;

  padding:30px;
}


/* =========================================================
   MOBILE TOPBAR
========================================================= */

.admin-mobile-topbar{
  display:none;
}


/* =========================================================
   BACKDROP
========================================================= */

.admin-sidebar-backdrop{
  display:none;
}


/* =========================================================
   TABLET
========================================================= */

@media(max-width:700px){

  .admin-shell{
    display:block;
  }

  .admin-mobile-topbar{
    position:sticky;

    top:0;

    width:100%;
    height:60px;

    box-sizing:border-box;

    padding:0 13px;

    display:flex;
    align-items:center;

    gap:10px;

    background:#171717;

    color:#fff;

    z-index:950;

    box-shadow:0 2px 10px rgba(0,0,0,.16);
  }

  .admin-mobile-menu{
    width:38px;
    height:38px;

    padding:0;

    border:0;
    outline:0;

    display:grid;
    place-items:center;

    background:transparent;

    color:#fff;

    border-radius:9px;

    cursor:pointer;
  }

  .admin-mobile-menu:hover{
    background:#252525;
  }

  .admin-mobile-brand{
    display:flex;
    align-items:center;

    gap:6px;

    font-size:19px;

    font-weight:950;

    letter-spacing:-.4px;
  }

  .admin-mobile-brand span{
    padding:4px 5px;

    background:#FF0000;

    border-radius:4px;

    font-size:7px;
  }

  .admin-side{
    width:280px;

    max-width:calc(100vw - 35px);

    transform:translateX(-105%);

    transition:transform .22s ease;

    box-shadow:8px 0 30px rgba(0,0,0,.22);
  }

  .admin-side.admin-side-open{
    transform:translateX(0);
  }

  .admin-close-btn{
    width:34px;
    height:34px;

    padding:0;

    border:1px solid #303030;
    outline:0;

    display:grid;
    place-items:center;

    background:#222;

    color:#aaa;

    border-radius:9px;

    cursor:pointer;
  }

  .admin-close-btn:hover{
    background:#FF0000;
    color:#fff;
    border-color:#FF0000;
  }

  .admin-sidebar-backdrop{
    display:block;

    position:fixed;

    inset:0;

    background:rgba(0,0,0,.48);

    z-index:990;

    backdrop-filter:blur(2px);
  }

  .admin-main{
    width:100%;

    margin:0;

    padding:16px 12px;
  }
}


/* =========================================================
   SMALL MOBILE
========================================================= */

@media(max-width:420px){

  .admin-side{
    width:270px;
  }

  .admin-main{
    padding:13px 10px;
  }
}

`;