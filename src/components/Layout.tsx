import React from "react";
import BottomNav from "./BottomNav";
import Header from "./Header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="page-content">
        <div className="page-inner">{children}</div>
      </main>
      <BottomNav />
      <style>{`
        .app-shell{min-height:100dvh;width:100%;background:#fff;}
        .page-content{width:100%;min-height:calc(100dvh - 60px);padding:14px 10px calc(96px + env(safe-area-inset-bottom));box-sizing:border-box;}
        .page-inner{width:min(100%,920px);margin:0 auto;}
        @media(min-width:700px){.page-content{padding-left:18px;padding-right:18px;padding-bottom:104px;}.page-inner{width:min(100%,920px);}}
        @media(max-width:390px){.page-content{padding:10px 8px calc(92px + env(safe-area-inset-bottom));}}
      `}</style>
    </div>
  );
}
