import React from 'react';import Layout from '@/components/Layout';import {useAuth} from '@/context/AuthContext';export default function ProfilePage(){
  React.useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-engage-style", "PAGE_CSS");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
const{user,logout}=useAuth();return <Layout><div className="profile-page"><div className="profile-card"><div className="profile-avatar">{(user?.name||'U')[0].toUpperCase()}</div><h1>{user?.name||'User'}</h1><p>{user?.email||''}</p><span className="role-chip">{user?.role||'user'}</span><button className="profile-logout" onClick={logout}>LOG OUT</button></div></div></Layout>}

/* ===== PROFILEPAGE CSS — kept inside this file ===== */
const PAGE_CSS = String.raw`
.profile-page{width:min(100%,620px);margin:0 auto;padding:10px 0 32px}
.profile-card{display:flex;flex-direction:column;align-items:center;text-align:center;padding:28px 18px 22px;border:1px solid #ededed;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.045)}
.profile-avatar{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:#FF0000;color:#fff;font-size:34px;font-weight:950;box-shadow:0 8px 20px rgba(255,0,0,.18)}
.profile-card h1{margin:16px 0 4px;color:#171717;font-size:28px;line-height:1.1;font-weight:950;letter-spacing:-.5px}
.profile-card p{margin:0;color:#777;font-size:13px}
.role-chip{display:inline-flex;align-items:center;justify-content:center;margin-top:12px;padding:6px 12px;border-radius:999px;background:#fff1f1;color:#FF0000;border:1px solid #ffd0d0;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.35px}
.profile-logout{width:100%;max-width:390px;min-height:48px;margin-top:24px;border:0;border-radius:10px;background:#FF0000;color:#fff;font-size:13px;font-weight:950;letter-spacing:.15px;box-shadow:0 6px 16px rgba(255,0,0,.16)}
.profile-logout:active{transform:translateY(1px)}
@media(max-width:600px){.profile-page{padding:6px 0 26px}.profile-card{padding:24px 14px 18px;border-radius:16px}.profile-avatar{width:84px;height:84px;font-size:31px}.profile-card h1{font-size:25px;margin-top:14px}.profile-card p{font-size:12px}.profile-logout{min-height:46px;margin-top:22px}}
@media(max-width:380px){.profile-card{padding-top:20px}.profile-avatar{width:78px;height:78px;font-size:29px}.profile-card h1{font-size:23px}.profile-card p{font-size:11px}}
`;
