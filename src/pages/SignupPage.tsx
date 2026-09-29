import React,{useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {Mail,Lock,UserRound,Eye,EyeOff,UserPlus} from "lucide-react";
import {useAuth} from "@/context/AuthContext";

export default function SignupPage(){
  React.useLayoutEffect(()=>{
    const style=document.createElement("style");
    style.setAttribute("data-engage-style","SIGNUP_PAGE_CSS");
    style.textContent=PAGE_CSS;
    document.head.appendChild(style);
    return()=>style.remove();
  },[]);

  const nav=useNavigate();
  const {signup,googleLogin,loading}=useAuth();
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [confirm,setConfirm]=useState("");
  const [show,setShow]=useState(false);
  const [error,setError]=useState("");
  const [googleBusy,setGoogleBusy]=useState(false);
  const [accountType,setAccountType]=useState<"earning"|"promotion">("earning");

  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");
    if(pass!==confirm){setError("Passwords do not match.");return;}
    try{await signup(name,email,pass,accountType);nav(accountType === "promotion" ? "/campaigns" : "/video",{replace:true});}
    catch(e:any){setError(e?.message||"Signup failed. Please try again.");}
  }

  async function continueWithGoogle(){
    if(googleBusy)return;
    setError("");setGoogleBusy(true);
    try{await googleLogin(accountType);}
    catch(e:any){setError(e?.message||"Google sign-up failed. Please check your Google/Supabase configuration.");setGoogleBusy(false);}
  }

  return <div className="auth-screen">
    <div className="auth-card signup-card">
      <div className="auth-brand"><span className="auth-brand-mark">E</span><span>ENGAGE</span></div>
      <div className="auth-tag">WATCH • CREATE • EARN</div>
      <h1>Create account</h1>
      <p className="auth-subtitle">Choose how you want to use ENGAGE</p>
      <div className="account-type-picker" role="radiogroup" aria-label="Account type">
        <button type="button" className={accountType === "earning" ? "selected" : ""} onClick={()=>setAccountType("earning")} aria-pressed={accountType === "earning"}>
          <strong>💰 EARNING</strong><span>Watch content and earn coins.</span>
        </button>
        <button type="button" className={accountType === "promotion" ? "selected" : ""} onClick={()=>setAccountType("promotion")} aria-pressed={accountType === "promotion"}>
          <strong>📣 PROMOTION</strong><span>Create campaigns using coins.</span>
        </button>
      </div>
      {error&&<div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={submit} className="auth-form">
        <label>Name</label><div className="auth-field"><UserRound/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required/></div>
        <label>Email ID</label><div className="auth-field"><Mail/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required/></div>
        <label>Password</label><div className="auth-field"><Lock/><input value={pass} onChange={e=>setPass(e.target.value)} type={show?"text":"password"} placeholder="Minimum 6 characters" autoComplete="new-password" minLength={6} required/><button type="button" className="auth-eye" onClick={()=>setShow(x=>!x)}>{show?<EyeOff/>:<Eye/>}</button></div>
        <label>Confirm Password</label><div className="auth-field"><Lock/><input value={confirm} onChange={e=>setConfirm(e.target.value)} type={show?"text":"password"} placeholder="Repeat password" autoComplete="new-password" required/></div>
        <button className="auth-primary" disabled={loading||googleBusy} type="submit"><UserPlus size={18}/>{loading?"Creating account…":"CREATE ACCOUNT"}</button>
      </form>

      <div className="auth-divider"><span/>OR<span/></div>
      <button type="button" className="google-btn" disabled={loading||googleBusy} onClick={continueWithGoogle}><span className="google-g">G</span>{googleBusy?"Connecting to Google…":"Continue with Google"}</button>
      <div className="auth-switch"><span>Already have an account?</span><Link to="/login">LOGIN</Link></div>
    </div>
  </div>;
}

const PAGE_CSS=String.raw`
.auth-screen{min-height:100dvh;box-sizing:border-box;display:grid;place-items:center;padding:28px 16px;background:linear-gradient(145deg,#FF0000 0%,#df252f 48%,#bd1e2b 100%)}
.auth-card{width:min(100%,430px);box-sizing:border-box;background:#fff;border-radius:22px;padding:30px 32px 24px;box-shadow:0 24px 70px rgba(0,0,0,.22)}
.auth-brand{display:flex;align-items:center;justify-content:center;gap:12px;color:#FF0000;font-size:31px;line-height:1;font-weight:950;letter-spacing:-1px}.auth-brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#FF0000;color:#fff;font-size:24px;font-weight:1000;box-shadow:0 7px 16px rgba(237,52,52,.22)}
.auth-tag{text-align:center;color:#999;font-size:9px;font-weight:900;letter-spacing:1.1px;margin-top:10px}.auth-card h1{text-align:center;margin:24px 0 5px;font-size:27px;line-height:1.1;color:#171717}.auth-subtitle{text-align:center;color:#888;font-size:11px;margin:0 0 19px}.account-type-picker{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:0 0 15px}.account-type-picker button{min-height:68px;padding:10px;border:1px solid #e2e2e2;border-radius:11px;background:#fff;text-align:left;cursor:pointer}.account-type-picker button.selected{border-color:#FF0000;background:#fff5f5;box-shadow:0 0 0 2px rgba(237,52,52,.07)}.account-type-picker strong{display:block;color:#222;font-size:10px;font-weight:950}.account-type-picker span{display:block;margin-top:5px;color:#888;font-size:8px;line-height:1.35}.auth-form label{display:block;margin:10px 0 6px;color:#444;font-size:10px;font-weight:900}.auth-field{position:relative}.auth-field>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:#aaa;pointer-events:none}.auth-field input{width:100%;height:46px;box-sizing:border-box;padding:0 42px;border:1px solid #dedede;border-radius:10px;outline:none;background:#fff;color:#222;font-size:13px;transition:border-color .16s,box-shadow .16s}.auth-field input:focus{border-color:#FF0000;box-shadow:0 0 0 3px rgba(237,52,52,.08)}.auth-eye{position:absolute;right:6px;top:5px;width:36px;height:36px;border:0;background:transparent;color:#aaa;display:grid;place-items:center;border-radius:8px}.auth-eye svg{width:18px}.auth-primary{width:100%;height:50px;margin-top:17px;border:0;border-radius:10px;background:#FF0000;color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:950;box-shadow:0 7px 17px rgba(237,52,52,.20)}.auth-primary:disabled,.google-btn:disabled{opacity:.65;cursor:not-allowed}.auth-divider{display:flex;align-items:center;gap:10px;margin:17px 0 12px;color:#aaa;font-size:9px}.auth-divider span{height:1px;background:#e6e6e6;flex:1}.google-btn{width:100%;height:47px;border:1px solid #dedede;border-radius:10px;background:#fff;color:#222;display:flex;align-items:center;justify-content:center;gap:9px;font-size:12px;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,.03)}.google-g{width:20px;height:20px;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:16px;font-weight:900;color:#4285f4}.auth-switch{display:flex;justify-content:center;align-items:center;gap:7px;margin:18px 0 2px;padding-top:15px;border-top:1px solid #eee;color:#777;font-size:10px}.auth-switch a{color:#FF0000;font-weight:950;text-decoration:none}.auth-error{margin:0 0 12px;padding:9px 11px;border:1px solid #ffd0d0;border-radius:9px;background:#fff3f3;color:#c52222;font-size:10px;line-height:1.4}
@media(max-width:520px){.account-type-picker{grid-template-columns:1fr}.auth-screen{padding:18px 12px}.auth-card{padding:25px 18px 19px;border-radius:18px}.auth-brand{font-size:27px}.auth-card h1{font-size:24px;margin-top:21px}}
`;
