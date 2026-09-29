import AdminCampaigns from "@/admin/AdminCampaigns";
import AdminContent from "@/admin/AdminContent";
import AdminDashboard from "@/admin/AdminDashboard";
import AdminLayout from "@/admin/AdminLayout";
import AdminSettings from "@/admin/AdminSettings";
import AdminUsers from "@/admin/AdminUsers";
import AdminWithdrawals from "@/admin/AdminWithdrawals";
import Protected from "@/components/Protected";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider, useData } from "@/context/DataContext";
import AddPage from "@/pages/AddPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CreateCampaignPage from "@/pages/CreateCampaignPage";
import LivePage from "@/pages/LivePage";
import LoginPage from "@/pages/LoginPage";
import MyCampaignsPage from "@/pages/MyCampaignsPage";
import ProfilePage from "@/pages/ProfilePage";
import ShortsPage from "@/pages/ShortsPage";
import SignupPage from "@/pages/SignupPage";
import VideoPage from "@/pages/VideoPage";
import WalletPage from "@/pages/WalletPage";
import React, { useLayoutEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

function AccountOnly({ type, children }: { type: "earning" | "promotion"; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === "admin" || user?.accountType === type) return <>{children}</>;
  return <Navigate to={user?.accountType === "promotion" ? "/campaigns" : "/video"} replace />;
}


function CreatorOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = user.role === "admin" || user.role === "creator" || user.accountType === "promotion";
  return allowed ? <>{children}</> : <Navigate to="/video" replace />;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.role === "admin" ? (
    <>{children}</>
  ) : (
    <Navigate to="/video" replace />
  );
}
function SocialBarController() {
  const { adminSettings } = useData();

  React.useEffect(() => {
    const scriptId = "engage-social-bar-script";
    const existing = document.getElementById(scriptId);

    if (adminSettings?.socialBarEnabled !== true) {
      existing?.remove();
      document.querySelectorAll(
        '[class*="socialbar"], [id*="socialbar"], [class*="social-bar"], [id*="social-bar"], iframe[src*="profitableratecpmnetwork"]'
      ).forEach((el) => el.remove());
      return;
    }

    if (existing) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = "https://pl30563401.profitableratecpmnetwork.com/c4/c8/62/c4c862608593421d0ab61d9fa08a3d78.js";
    document.head.appendChild(script);

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [adminSettings?.socialBarEnabled]);

  return null;
}

function RoutesView() {
  const location = useLocation();

  /*
   * Prevent a stale route from being painted for even one frame while
   * React Router changes pathname. This is especially noticeable when
   * switching Shorts -> Video on mobile.
   *
   * useLayoutEffect runs before the browser paints, so the previous
   * VideoPage cannot flash while the Shorts route is being replaced.
   */
  const [paintedPath, setPaintedPath] = useState(location.pathname);

  useLayoutEffect(() => {
    if (paintedPath !== location.pathname) {
      setPaintedPath(location.pathname);
    }
  }, [location.pathname, paintedPath]);

  if (paintedPath !== location.pathname) {
    return null;
  }

  return (
    <div className="engage-route-root" key={location.pathname}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/" element={<Navigate to="/video" replace />} />
      <Route
        path="/video"
        element={
          <Protected><AccountOnly type="earning"><VideoPage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/shorts"
        element={
          <Protected><AccountOnly type="earning"><ShortsPage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/live"
        element={
          <Protected><AccountOnly type="earning"><LivePage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/campaigns"
        element={
          <Protected><AccountOnly type="promotion"><CampaignsPage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/my-campaigns"
        element={
          <Protected><AccountOnly type="promotion"><MyCampaignsPage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/create-campaign"
        element={
          <Protected><CreatorOnly><CreateCampaignPage /></CreatorOnly></Protected>
        }
      />
      <Route
        path="/add"
        element={
          <Protected><AccountOnly type="promotion"><AddPage /></AccountOnly></Protected>
        }
      />
      <Route
        path="/wallet"
        element={
          <Protected>
            <WalletPage />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminOnly>
              <AdminLayout />
            </AdminOnly>
          </Protected>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="users">
          <Route index element={<AdminUsers />} />
          <Route path=":userId" element={<AdminUsers />} />
        </Route>
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/video" replace />} />
      </Routes>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <style>{GLOBAL_CSS}</style>
      <AuthProvider>
        <DataProvider>
          <SocialBarController />
          <RoutesView />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/* ===== GLOBAL CSS — kept inside App.tsx ===== */
const GLOBAL_CSS = String.raw`
*{
  box-sizing: border-box;
}

.engage-route-root{
  width: 100%;
  min-height: 100%;
}

html,
body,
#root{
  margin: 0;
  min-height: 100%;
  width: 100%;
  font-family: Inter, Arial, sans-serif;
  background: #fff;
  color: #222;
  overflow-x: hidden;
}

button,
input,
select{
  font: inherit;
}

button{
  cursor: pointer;
}

.content-head{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 4px 0 14px;
}

.content-head .primary{
width:30%;
}

.content-head h1{
  font-size: 24px;
  margin: 0;
  font-weight: 900;
}

.content-head p{
  margin: 4px 0 0;
  color: #777;
  font-size: 12px;
}

.status-pill,
.live-status{
  font-size: 10px;
  font-weight: 900;
  padding: 7px 9px;
  border-radius: 7px;
  background: #fff0f0;
  color: #e33;
  white-space: nowrap;
}

.watch-stats{
  margin-top: 10px;
  background: #fff7f7;
  border: 1px solid #ffd1d1;
  border-radius: 10px;
  padding: 12px;
  display: grid;
  grid-template-columns: 70px 1fr 65px;
  align-items: center;
  gap: 10px;
}

.watch-stats b{
  display: block;
  font-size: 20px;
  color: #e63232;
}

.watch-stats small{
  display: block;
  color: #777;
  font-size: 9px;
  font-weight: 800;
  margin-top: 2px;
}

.watch-line > div{
  height: 6px;
  background: #ddd;
  border-radius: 10px;
  overflow: hidden;
}

.watch-line i{
  display: block;
  height: 100%;
  background: #FF0000;
  border-radius: 10px;
}

.watch-line span{
  display: block;
  text-align: center;
  color: #888;
  font-size: 10px;
  margin-top: 5px;
}

.primary,
.secondary,
.google{
  border: 0;
  border-radius: 7px;
  padding: 12px 14px;
  font-weight: 900;
}

.primary{
  background: #FF0000;
  color: #fff;
}

.secondary{
  background: #eee;
  color: #444;
}

.wide{
  width: 100%;
}

.qualified{
  background: #eafff0;
  color: #0a9943;
  border: 1px solid #b8efca;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  margin: 10px 0;
}

.section-title{
  font-weight: 900;
  margin: 17px 0 8px;
}

.item-note,
.admin-controlled{
  background: #f7f7f7;
  border: 1px solid #e8e8e8;
  border-radius: 9px;
  padding: 12px;
  color: #666;
  font-size: 12px;
  margin-top: 10px;
}

.avatar{
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #FF0000;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 900;
}

.avatar.big{
  width: 90px;
  height: 90px;
  margin: auto;
  font-size: 30px;
}

.login-screen{
  min-height: 100vh;
  background: linear-gradient(135deg, #FF0000, #b71f2b);
  display: grid;
  place-items: center;
  padding: 18px;
}

.login-card{
  width: min(430px, 100%);
  background: #fff;
  border-radius: 15px;
  padding: 26px;
  box-shadow: 0 20px 50px #0004;
}

.login-logo{
  text-align: center;
  font-size: 32px;
  font-weight: 1000;
  color: #FF0000;
}

.login-tag{
  text-align: center;
  color: #777;
  font-size: 11px;
}

.login-card h1{
  text-align: center;
  margin: 20px 0 4px;
}

.muted{
  text-align: center;
  color: #888;
  font-size: 12px;
}

.login-card label{
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: #555;
  margin: 14px 0 5px;
}

.field-wrap{
  position: relative;
}

.field-wrap svg{
  position: absolute;
  left: 12px;
  top: 12px;
  width: 17px;
  color: #aaa;
}

.field-wrap input{
  width: 100%;
  padding: 12px 40px;
  border: 1px solid #ddd;
  border-radius: 7px;
}

.field-wrap button{
  position: absolute;
  right: 7px;
  top: 7px;
  border: 0;
  background: none;
  color: #777;
}

.error-box{
  background: #fff0f0;
  color: #d22;
  border: 1px solid #ffd0d0;
  padding: 9px 11px;
  border-radius: 8px;
  font-size: 10px;
  margin: 10px 0;
}

.admin-head{
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.admin-head h1{
  margin: 0;
}

.admin-head p{
  color: #777;
  margin-top: 4px;
}

.admin-stats > div,
.admin-panel,
.admin-row{
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  padding: 15px;
}

.admin-panel{
  margin-top: 15px;
}

.admin-row{
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-row span{
  display: block;
  color: #777;
  font-size: 10px;
  margin-top: 4px;
}

.form-page .primary{
  margin-top: 15px;
}

.engage-mark{
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-right: 3px;
  border-radius: 9px;
  background: #FF0000;
  color: #fff;
  font-weight: 1000;
  font-size: 22px;
  vertical-align: middle;
  box-shadow: 0 3px 8px rgba(237, 52, 52, 0.25);
}

.password-eye{
  position: absolute;
  right: 8px;
  top: 7px;
  width: 32px;
  height: 32px;
  padding: 5px;
  border: 0;
  background: transparent;
  color: #aaa;
}

.password-eye svg{
  position: static !important;
  width: 18px !important;
}

.item-note,

.campaign-card,

.campaign-card h3,

.form-page label,

.form-input,
.settings-grid input,

.demo-box b,

.admin-side > a,

.admin-stats > div,
.admin-panel,

.settings-grid input,

.campaign-admin-info span,

.campaign-admin-info span,

.campaign-content-name,

.signup-prompt,

.live-mode-card > b,

.form-page{
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

.create-btn,
.form-page .primary{
  width: 100%;
  min-height: 47px;
  margin-top: 12px;
  border: 0;
  border-radius: 9px;
  background: #FF0000;
  color: #fff;
  font-size: 12px;
  font-weight: 950;
  box-shadow: 0 5px 12px rgba(237, 52, 52, 0.18);
}

.create-btn:hover,
.form-page .primary:hover{
  background: #d92d2d;
}

@keyframes createSpin{to{
    transform: rotate(360deg);
  }}

.engage-toast,
.reward-toast{
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(calc(100% - 28px), 420px);
  padding: 12px 14px;
  border-radius: 12px;
  box-shadow: 0 12px 35px #0003;
  animation: toastIn 0.22s ease-out;
}

.reward-toast{
  top: 78px;
  background: #111;
  color: #fff;
  border: 1px solid #333;
}

.engage-toast svg,
.reward-toast svg{
  flex: none;
}

.engage-toast b,
.reward-toast b{
  display: block;
  font-size: 12px;
}

.engage-toast span,
.reward-toast span{
  display: block;
  margin-top: 2px;
  font-size: 9px;
  opacity: 0.9;
}

@keyframes toastIn{from{
    opacity: 0;
    transform: translate(-50%, -8px);
  }
to{
    opacity: 1;
    transform: translate(-50%, 0);
  }}

.empty-content-card{
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 30px 18px;
  border: 1px solid #eee;
  border-radius: 14px;
  background: #fff;
  color: #999;
}

.empty-content-card svg{
  color: #FF0000;
  margin-bottom: 10px;
}

.empty-content-card h2{
  margin: 0;
  color: #333;
  font-size: 18px;
}

.empty-content-card p{
  max-width: 360px;
  margin: 7px 0 0;
  color: #888;
  font-size: 11px;
  line-height: 1.5;
}

.login-card form{
  margin-top: 18px;
}

.login-card form label{
  margin-top: 13px;
}

.login-card form label:first-child{
  margin-top: 0;
}

.login-card .primary.wide,
.login-card .signup-btn{
  margin-top: 18px;
}

.login-card .google.wide{
  margin-top: 13px;
}

.login-card .signup-prompt,
.login-card .login-switch{
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #eee;
}

.login-card .demo-box{
  margin-top: 15px;
}

.login-card .error-box{
  margin-top: 14px;
  margin-bottom: 2px;
}

.login-card button.wide{
  width: 100%;
  min-height: 45px;
}

@keyframes engageAdIn{from{
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
to{
    opacity: 1;
    transform: scale(1) translateY(0);
  }}

[class*="socialbar"],
[id*="socialbar"],
[class*="social-bar"],
[id*="social-bar"]{
  position: fixed !important;
  top: 14px !important;
  right: 14px !important;
  left: auto !important;
  bottom: auto !important;
  width: 92px !important;
  height: 92px !important;
  max-width: 92px !important;
  max-height: 92px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  z-index: 2147482000 !important;
  overflow: hidden !important;
  border-radius: 10px !important;
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.24) !important;
}

iframe[title*="Social"],
iframe[src*="profitableratecpmnetwork"]{
  max-width: 100% !important;
  height:45px;
  border-radius: 10px !important;
}

[class*="socialbar"] button,
[id*="socialbar"] button,
[class*="social-bar"] button,
[id*="social-bar"] button{
  position: absolute !important;
  top: 3px !important;
  right: 3px !important;
  z-index: 2147483000 !important;
  width: 22px !important;
  height: 22px !important;
  min-width: 22px !important;
  padding: 0 !important;
  border: 2px solid #fff !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(0, 0, 0, 0.78) !important;
  color: #fff !important;
  cursor: pointer !important;
}

@media (max-width: 700px){.watch-stats{
    grid-template-columns: 60px 1fr 55px;
  }}

@media (max-width: 520px){.login-card{
    padding: 22px 20px;
  }
.login-screen{
    padding: 12px;
  }}

@media (min-width: 901px){.login-screen{
    min-height: 100vh;
    padding: 50px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
.login-card{
    width: min(100%, 430px);
    margin: 0 auto;
    padding: 30px 30px 26px;
  }}

@media (min-width: 601px) and (max-width: 1100px){.login-card{
    width: min(94vw, 430px);
  }}

@media (min-width: 901px){.watch-stats{
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
  }}

@media (max-width: 600px){.login-screen{
    min-height: 100dvh;
    padding: 22px 12px 30px;
    align-items: center;
  }
.login-card{
    width: 100%;
    max-width: 430px;
    margin: 14px auto 0;
    padding: 22px 17px 20px;
    border-radius: 15px;
  }
.login-card form{
    margin-top: 20px;
  }
.login-card .primary.wide,
    .login-card .signup-btn{
    margin-top: 19px;
  }
.login-logo{
    margin-top: 2px;
  }}

@media (min-width: 1200px){.login-card{
    width: 440px;
    padding: 34px 34px 28px;
  }
.login-card form{
    margin-top: 21px;
  }}

@media (max-width: 600px){[class*="socialbar"],
    [id*="socialbar"],
    [class*="social-bar"],
    [id*="social-bar"]{
    top: 10px !important;
    right: 8px !important;
    width: 82px !important;
    height: 82px !important;
    max-width: 82px !important;
    max-height: 82px !important;
    border-radius: 9px !important;
  }

.create-btn{
  width:100%;
  min-height:48px;
  margin-top:14px !important;
  display:flex !important;
  align-items:center;
  justify-content:center;
  gap:5px;
  border:0;
  border-radius:10px;
  background:#FF0000;
  color:#fff;
  font-size:12px;
  font-weight:900;
  box-shadow:0 7px 16px rgba(237,52,52,.18);
}

.create-btn:hover{
  background:#d92d2d;
}

.create-btn span{
  opacity:.92;
}
`;
