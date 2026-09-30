import React,{useState} from "react";
import {useNavigate,Link} from "react-router-dom";
import {Mail,Lock,Eye,EyeOff,LogIn} from "lucide-react";
import {useAuth} from "@/context/AuthContext";

export default function LoginPage(){
  React.useLayoutEffect(() => {
    const style=document.createElement("style");
    style.setAttribute("data-engage-style","LOGIN_PAGE_CSS");
    style.textContent=PAGE_CSS;
    document.head.appendChild(style);
    return()=>style.remove();
  },[]);

  const nav=useNavigate();
  const {login,googleLogin,loading}=useAuth();
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [show,setShow]=useState(false);
  const [err,setErr]=useState("");
  const [googleBusy,setGoogleBusy]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setErr("");
    try{
      const ok=await login(email,pass);
      if(!ok){setErr("Invalid email or password.");return;}
      nav("/video",{replace:true});
    }catch(x:any){setErr(x?.message||"Login failed. Please try again.");}
  }

  async function continueWithGoogle(){
    if(googleBusy)return;
    setErr("");
    setGoogleBusy(true);
    try{
      await googleLogin();
    }catch(e:any){
      setErr(e?.message||"Google sign-in failed. Please check your Google/Supabase configuration.");
      setGoogleBusy(false);
    }
  }

  return <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-brand"><span className="auth-brand-mark">E</span><span>ENGAGE</span></div>
      <div className="auth-tag">WATCH • CREATE • EARN</div>
      <h1>Welcome back</h1>
      <p className="auth-subtitle">Sign in to continue to your account</p>

      {err&&<div className="auth-error" role="alert">{err}</div>}

      <form onSubmit={submit} className="auth-form">
        <label>Email ID</label>
        <div className="auth-field"><Mail/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required/></div>

        <label>Password</label>
        <div className="auth-field"><Lock/><input value={pass} onChange={e=>setPass(e.target.value)} type={show?"text":"password"} placeholder="Enter your password" autoComplete="current-password" required/>
          <button type="button" className="auth-eye" onClick={()=>setShow(x=>!x)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff/>:<Eye/>}</button>
        </div>

        <button className="auth-primary" disabled={loading||googleBusy} type="submit">
          <LogIn size={18}/>{loading?"Signing in…":"LOGIN"}
        </button>
      </form>

      <div className="auth-divider"><span/>OR<span/></div>

      <button type="button" className="google-btn" disabled={loading||googleBusy} onClick={continueWithGoogle}>
        <span className="google-g">G</span>{googleBusy?"Connecting to Google…":"Continue with Google"}
      </button>

      <div className="auth-switch"><span>Don't have an account?</span><Link to="/signup">CREATE ACCOUNT</Link></div>
    </div>
  </div>;
}

const PAGE_CSS=String.raw`
.auth-screen{min-height:100dvh;box-sizing:border-box;display:grid;place-items:center;padding:28px 16px;background:linear-gradient(145deg,#FF0000 0%,#df252f 48%,#bd1e2b 100%)}
.auth-card{width:min(100%,430px);box-sizing:border-box;background:#fff;border-radius:22px;padding:30px 32px 24px;box-shadow:0 24px 70px rgba(0,0,0,.22)}
.auth-brand{display:flex;align-items:center;justify-content:center;gap:12px;color:#FF0000;font-size:31px;line-height:1;font-weight:950;letter-spacing:-1px}.auth-brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#FF0000;color:#fff;font-size:24px;font-weight:1000;box-shadow:0 7px 16px rgba(237,52,52,.22)}
.auth-tag{text-align:center;color:#999;font-size:9px;font-weight:900;letter-spacing:1.1px;margin-top:10px}.auth-card h1{text-align:center;margin:24px 0 5px;font-size:27px;line-height:1.1;color:#171717}.auth-subtitle{text-align:center;color:#888;font-size:11px;margin:0 0 22px}.auth-form{margin-top:0}.auth-form label{display:block;margin:13px 0 6px;color:#444;font-size:10px;font-weight:900}.auth-field{position:relative}.auth-field>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:#aaa;pointer-events:none}.auth-field input::-ms-reveal,.auth-field input::-ms-clear{display:none}.auth-field input::-webkit-credentials-auto-fill-button{visibility:hidden;pointer-events:none;position:absolute;right:0}.auth-field input{width:100%;height:48px;box-sizing:border-box;padding:0 42px;border:1px solid #dedede;border-radius:10px;outline:none;background:#fff;color:#222;font-size:13px;transition:border-color .16s,box-shadow .16s}.auth-field input:focus{border-color:#FF0000;box-shadow:0 0 0 3px rgba(237,52,52,.08)}.auth-eye{position:absolute;right:6px;top:6px;width:36px;height:36px;border:0;background:transparent;color:#aaa;display:grid;place-items:center;border-radius:8px}.auth-eye svg{width:18px}.auth-primary{width:100%;height:50px;margin-top:18px;border:0;border-radius:10px;background:#FF0000;color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:950;box-shadow:0 7px 17px rgba(237,52,52,.20)}.auth-primary:disabled,.google-btn:disabled{opacity:.65;cursor:not-allowed}.auth-divider{display:flex;align-items:center;gap:10px;margin:18px 0 13px;color:#aaa;font-size:9px}.auth-divider span{height:1px;background:#e6e6e6;flex:1}.google-btn{width:100%;height:48px;border:1px solid #dedede;border-radius:10px;background:#fff;color:#222;display:flex;align-items:center;justify-content:center;gap:9px;font-size:12px;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,.03)}.google-g{width:20px;height:20px;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:16px;font-weight:900;color:#4285f4}.auth-switch{display:flex;justify-content:center;align-items:center;gap:7px;margin:19px 0 12px;padding-top:16px;border-top:1px solid #eee;color:#777;font-size:10px}.auth-switch a{color:#FF0000;font-weight:950;text-decoration:none}
@media(max-width:520px){.auth-screen{padding:18px 12px}.auth-card{padding:25px 18px 19px;border-radius:18px}.auth-brand{font-size:27px}.auth-card h1{font-size:24px;margin-top:21px}}
`;
