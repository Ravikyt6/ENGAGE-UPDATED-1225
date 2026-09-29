import React, { useEffect, useState } from "react";
import { FileText, HelpCircle, Info, Mail, Save, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dataProvider } from "@/services/dataProvider";
import type { SitePage, SitePageSlug } from "@/types";

const DEFAULTS: Record<SitePageSlug, SitePage> = {
  privacy: { slug: "privacy", title: "Privacy Policy", content: "" },
  terms: { slug: "terms", title: "Terms & Conditions", content: "" },
  contact: { slug: "contact", title: "Contact Us", content: "" },
  about: { slug: "about", title: "About ENGAGE", content: "" },
  help: { slug: "help", title: "Help & Support", content: "" },
};

const ICONS: Record<SitePageSlug, LucideIcon> = {
  privacy: ShieldCheck,
  terms: FileText,
  contact: Mail,
  about: Info,
  help: HelpCircle,
};

export default function AdminSiteContent() {
  const [pages, setPages] = useState<Record<SitePageSlug, SitePage>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all((Object.keys(DEFAULTS) as SitePageSlug[]).map((slug) =>
      dataProvider.getSitePage(slug).catch(() => DEFAULTS[slug])
    )).then((items) => {
      if (!alive) return;
      const next = { ...DEFAULTS } as Record<SitePageSlug, SitePage>;
      items.forEach((item) => { next[item.slug] = item; });
      setPages(next);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  function change(slug: SitePageSlug, field: "title" | "content", value: string) {
    setPages((current) => ({ ...current, [slug]: { ...current[slug], [field]: value } }));
    setSaved(false);
    setError("");
  }

  async function save() {
    setSaving(true); setSaved(false); setError("");
    try {
      await dataProvider.updateSitePages(Object.values(pages));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message || "Could not save site content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-site-content-page">
      <div className="admin-head">
        <div><h1>Site Content</h1><p>Edit the public Privacy, Terms, Contact and support pages.</p></div>
      </div>

      {loading ? <div className="site-content-loading">Loading page content…</div> : (
        <div className="site-content-grid">
          {(Object.keys(DEFAULTS) as SitePageSlug[]).map((slug) => {
            const Icon = ICONS[slug];
            const page = pages[slug];
            return (
              <section className="site-content-card" key={slug}>
                <div className="site-content-card-head">
                  <span className="site-content-icon"><Icon size={18} /></span>
                  <div><b>{DEFAULTS[slug].title}</b><small>/{slug}</small></div>
                </div>
                <label>Page title<input value={page.title} onChange={(e) => change(slug, "title", e.target.value)} /></label>
                <label>Content<textarea rows={9} value={page.content} onChange={(e) => change(slug, "content", e.target.value)} /></label>
              </section>
            );
          })}
        </div>
      )}

      {error && <div className="site-content-error">{error}</div>}
      <div className="site-content-save">
        <div><b>{saved ? "Content saved" : "Public page content"}</b><span>{saved ? "Changes are now visible on the corresponding public pages." : "Use plain text and line breaks. Content can be edited again anytime."}</span></div>
        <button type="button" className="primary" disabled={saving || loading} onClick={save}><Save size={16} /> {saving ? "SAVING…" : "SAVE CONTENT"}</button>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = String.raw`
.admin-site-content-page{max-width:980px;margin:0 auto;padding-bottom:40px}.site-content-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.site-content-card{padding:15px;border:1px solid #e7e7e7;border-radius:14px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.035)}
.site-content-card-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}.site-content-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:#fff1f1;color:#FF0000}.site-content-card-head b{display:block;font-size:12px;color:#222}.site-content-card-head small{display:block;margin-top:2px;color:#999;font-size:8px}.site-content-card label{display:block;margin-top:10px;color:#555;font-size:9px;font-weight:900}.site-content-card input,.site-content-card textarea{width:100%;box-sizing:border-box;margin-top:5px;border:1px solid #ddd;border-radius:9px;background:#fff;padding:10px;color:#222;font-size:10px;line-height:1.5;outline:none;resize:vertical}.site-content-card input:focus,.site-content-card textarea:focus{border-color:#FF0000;box-shadow:0 0 0 3px rgba(255,0,0,.06)}.site-content-loading{padding:35px;text-align:center;color:#999;background:#fff;border:1px solid #e8e8e8;border-radius:13px}.site-content-error{margin-top:12px;padding:10px;border:1px solid #ffd0d0;background:#fff1f1;color:#c52222;border-radius:9px;font-size:9px}.site-content-save{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:14px;padding:13px 15px;border:1px solid #e7e7e7;border-radius:13px;background:#fff}.site-content-save b{display:block;font-size:10px}.site-content-save span{display:block;margin-top:3px;color:#888;font-size:8px}.site-content-save button{display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}@media(max-width:760px){.site-content-grid{grid-template-columns:1fr}}@media(max-width:520px){.site-content-save{align-items:stretch;flex-direction:column}.site-content-save button{width:100%}}
`;
