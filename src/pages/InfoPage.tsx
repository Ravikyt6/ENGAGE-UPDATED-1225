import React, { useEffect, useState } from "react";
import { ArrowLeft, CircleHelp, FileText, Info, Mail, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { dataProvider } from "@/services/dataProvider";
import type { SitePageSlug } from "@/types";

const META: Record<SitePageSlug, { icon: LucideIcon; fallbackTitle: string }> = {
  privacy: { icon: ShieldCheck, fallbackTitle: "Privacy Policy" },
  terms: { icon: FileText, fallbackTitle: "Terms & Conditions" },
  contact: { icon: Mail, fallbackTitle: "Contact Us" },
  about: { icon: Info, fallbackTitle: "About ENGAGE" },
  help: { icon: CircleHelp, fallbackTitle: "Help & Support" },
};

export default function InfoPage() {
  const { slug } = useParams<{ slug: SitePageSlug }>();
  const navigate = useNavigate();
  const pageSlug = (slug && slug in META ? slug : "about") as SitePageSlug;
  const MetaIcon = META[pageSlug].icon;
  const [title, setTitle] = useState(META[pageSlug].fallbackTitle);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    dataProvider.getSitePage(pageSlug)
      .then((page) => {
        if (!alive) return;
        setTitle(page.title || META[pageSlug].fallbackTitle);
        setContent(page.content || "");
      })
      .catch((error) => {
        console.error("Site page load failed", error);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [pageSlug]);

  return (
    <div className="info-page-shell">
      <header className="info-topbar">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="info-back">
          <ArrowLeft size={19} />
        </button>
        <div className="info-brand">ENGAGE</div>
      </header>

      <main className="info-main">
        <Link to="/login" className="info-home-link">Back to login</Link>
        <section className="info-card">
          <div className="info-title-row">
            <div className="info-icon"><MetaIcon size={22} strokeWidth={2.2} /></div>
            <div>
              <h1>{title}</h1>
              <span>ENGAGE information</span>
            </div>
          </div>
          <div className="info-divider" />
          {loading ? (
            <div className="info-loading">Loading…</div>
          ) : (
            <div className="info-content">{content}</div>
          )}
        </section>
      </main>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = String.raw`
.info-page-shell{min-height:100dvh;background:#f8f8f8;color:#222}
.info-topbar{height:64px;display:flex;align-items:center;gap:12px;padding:0 16px;background:#FF0000;color:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12)}
.info-back{width:38px;height:38px;border:0;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;cursor:pointer}
.info-brand{font-size:22px;font-weight:950;letter-spacing:-.5px}
.info-main{width:min(100%,760px);margin:0 auto;padding:24px 16px 50px}
.info-home-link{display:inline-block;margin-bottom:13px;color:#FF0000;text-decoration:none;font-size:11px;font-weight:900}
.info-card{padding:20px;border:1px solid #e7e7e7;border-radius:17px;background:#fff;box-shadow:0 8px 25px rgba(0,0,0,.045)}
.info-title-row{display:flex;align-items:center;gap:12px}.info-icon{width:45px;height:45px;border-radius:12px;background:#fff0f0;color:#FF0000;display:grid;place-items:center;flex:none}
.info-title-row h1{margin:0;font-size:22px;line-height:1.1;font-weight:950}.info-title-row span{display:block;margin-top:4px;color:#888;font-size:9px}.info-divider{height:1px;background:#eee;margin:17px 0}
.info-content{white-space:pre-wrap;color:#555;font-size:12px;line-height:1.75}.info-loading{min-height:180px;display:grid;place-items:center;color:#999;font-size:11px}
@media(max-width:480px){.info-topbar{height:58px;padding:0 10px}.info-main{padding:16px 10px 35px}.info-card{padding:15px;border-radius:14px}.info-title-row h1{font-size:20px}.info-content{font-size:11px;line-height:1.7}}
`;
