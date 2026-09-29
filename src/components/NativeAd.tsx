import { X } from "lucide-react";
import React, { useEffect } from "react";

type NativePopupProps = {
  onClose: () => void;
  profitablerEnabled?: boolean;
};

type NativeCornerAdProps = {
  onClose?: () => void;
};

const NATIVE_AD_CSS = `
.native-square-ad{
  width:100% !important;
  min-height:250px !important;
  box-sizing:border-box !important;
  overflow:hidden !important;
  background:#fff !important;
}

.profitabler-square-container{
  width:300px !important;
  height:250px !important;
  min-width:300px !important;
  min-height:250px !important;
  max-width:calc(100vw - 44px) !important;
  margin:0 auto !important;
  display:block !important;
  overflow:hidden !important;
  background:#fff !important;
  box-sizing:border-box !important;
}

.profitabler-square-container iframe{
  display:block !important;
  width:300px !important;
  max-width:100% !important;
  height:250px !important;
  border:0 !important;
  margin:0 auto !important;
}

.native-popup-wait{
  width:100% !important;
  min-height:26px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  box-sizing:border-box !important;
  color:#888 !important;
  font-size:9px !important;
  font-weight:600 !important;
  border-top:1px solid #eee !important;
  background:#fff !important;
}


.native-popup-overlay {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  padding: 16px !important;
  box-sizing: border-box !important;

  background: rgba(0, 0, 0, 0.58) !important;

  z-index: 2147483000 !important;

  isolation: isolate !important;
}

.native-popup-card {
  position: relative !important;

  width: min(420px, calc(100vw - 32px)) !important;
  max-width: 420px !important;
  max-height: calc(100vh - 32px) !important;

  margin: 0 !important;

  overflow: auto !important;

  background: #ffffff !important;
  border-radius: 14px !important;

  box-shadow:
    0 20px 70px rgba(0, 0, 0, 0.4) !important;

  box-sizing: border-box !important;

  animation: engageNativeAdIn 0.18s ease-out;
}

.native-popup-close {
  position: absolute !important;

  top: 9px !important;
  right: 9px !important;

  z-index: 20 !important;

  width: 34px !important;
  height: 34px !important;

  padding: 0 !important;
  margin: 0 !important;

  display: grid !important;
  place-items: center !important;

  border: 0 !important;
  border-radius: 50% !important;

  background: rgba(255, 255, 255, 0.96) !important;
  color: #222 !important;

  cursor: pointer !important;

  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18) !important;
}

.native-popup-close:hover {
  background: #f4f4f4 !important;
}

.native-square-ad {
  width: 100% !important;
  box-sizing: border-box !important;
}

.profitabler-square-container {
  width:100% !important;
  min-height:250px !important;
  display:block !important;
  overflow:hidden !important;
  background:#fff !important;
}

.native-square-media {
  width: 100% !important;
  min-height: 220px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  background: #f2f2f2 !important;

  color: #666 !important;

  font-size: 12px !important;
  font-weight: 700 !important;

  box-sizing: border-box !important;
}

.native-square-media span {
  opacity: 0.8;
}

.native-square-body {
  width: 100% !important;

  padding: 18px !important;

  box-sizing: border-box !important;

  background: #fff !important;
}

.native-square-title {
  margin-bottom: 7px !important;

  color: #777 !important;

  font-size: 12px !important;
  font-weight: 600 !important;
}

.native-square-body h3 {
  margin: 0 0 8px !important;

  color: #171717 !important;

  font-size: 18px !important;
  line-height: 1.25 !important;
  font-weight: 800 !important;
}

.native-square-body p {
  margin: 0 0 16px !important;

  color: #666 !important;

  font-size: 14px !important;
  line-height: 1.4 !important;
}

.native-square-button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;

  min-height: 34px !important;

  padding: 7px 13px !important;

  border: 1px solid #cfcfcf !important;
  border-radius: 6px !important;

  background: #fff !important;
  color: #222 !important;

  font-size: 13px !important;
  font-weight: 700 !important;

  cursor: pointer !important;
}

.native-square-button:hover {
  background: #f5f5f5 !important;
}


/* =========================================================
   CORNER AD
   ========================================================= */

.native-corner-ad {
  position: fixed !important;

  right: 16px !important;
  bottom: 16px !important;

  width: 280px !important;
  max-width: calc(100vw - 32px) !important;

  z-index: 2147482000 !important;

  background: #fff !important;

  border-radius: 10px !important;

  overflow: hidden !important;

  box-shadow:
    0 10px 35px rgba(0, 0, 0, 0.25) !important;

  border: 1px solid #e5e5e5 !important;

  box-sizing: border-box !important;
}

.native-corner-close {
  position: absolute !important;

  top: 5px !important;
  right: 5px !important;

  z-index: 10 !important;

  width: 25px !important;
  height: 25px !important;

  padding: 0 !important;

  display: grid !important;
  place-items: center !important;

  border: 0 !important;
  border-radius: 50% !important;

  background: rgba(255, 255, 255, 0.95) !important;

  cursor: pointer !important;
}

.native-corner-square {
  width: 100% !important;
  height: 150px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  background: #f2f2f2 !important;

  color: #666 !important;

  font-size: 11px !important;
  font-weight: 700 !important;
}

.native-corner-content {
  padding: 11px !important;

  background: #fff !important;
}

.native-corner-content small {
  display: block !important;

  margin-bottom: 3px !important;

  color: #777 !important;

  font-size: 10px !important;
}

.native-corner-content strong {
  display: block !important;

  margin-bottom: 8px !important;

  color: #222 !important;

  font-size: 14px !important;
}

.native-corner-content button {
  min-height: 30px !important;

  padding: 5px 11px !important;

  border: 1px solid #ccc !important;
  border-radius: 5px !important;

  background: #fff !important;
  color: #222 !important;

  font-size: 12px !important;
  font-weight: 700 !important;

  cursor: pointer !important;
}


/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 600px) {

  .native-popup-overlay {
    padding: 12px !important;
  }

  .native-popup-card {
    width: calc(100vw - 24px) !important;
    max-width: 420px !important;
    max-height: calc(100vh - 24px) !important;

    border-radius: 13px !important;
  }

  .profitabler-square-container {
    width:280px !important;
    min-width:280px !important;
    max-width:calc(100vw - 44px) !important;
  min-height:250px !important;
  display:block !important;
  overflow:hidden !important;
  background:#fff !important;
}

.native-square-media {
    min-height: 190px !important;
  }

  .native-square-body {
    padding: 15px !important;
  }

  .native-square-body h3 {
    font-size: 17px !important;
  }

  .native-square-body p {
    font-size: 13px !important;
  }

  .native-corner-ad {
    left: 12px !important;
    right: 12px !important;
    bottom: 12px !important;

    width: auto !important;
    max-width: none !important;
  }

  .native-corner-square {
    height: 135px !important;
  }
}


/* =========================================================
   POPUP ANIMATION
   ========================================================= */

@keyframes engageNativeAdIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}


/*
 * Prevent accidental page scroll while popup is visible.
 * The component also restores the previous body state on close.
 */

body.engage-native-ad-open {
  overflow: hidden !important;
}
`;

function useNativeAdStyles() {
  useEffect(() => {
    const existing = document.querySelector(
      'style[data-engage-native-ad="true"]'
    );

    if (existing) return;

    const style = document.createElement("style");

    style.setAttribute(
      "data-engage-native-ad",
      "true"
    );

    style.textContent = NATIVE_AD_CSS;

    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);
}


/* =========================================================
   NATIVE POPUP
   ========================================================= */

export function NativePopup({
  onClose,
  profitablerEnabled = false,
}: NativePopupProps) {

  useNativeAdStyles();

  const [canClose, setCanClose] = React.useState(false);

  useEffect(() => {
    setCanClose(false);

    const timer = window.setTimeout(() => {
      setCanClose(true);
    }, 5000);

    // Trap browser Back while the popup is open.
    const currentUrl = window.location.href;
    window.history.pushState({ engageNativeAd: true }, "", currentUrl);

    const handlePopState = () => {
      window.history.pushState({ engageNativeAd: true }, "", currentUrl);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!profitablerEnabled) return;

    const id = "container-aaec7f8a921c541856ee76c4a156ac85";
    const container = document.getElementById(id);
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = "https://pl30563399.profitableratecpmnetwork.com/aaec7f8a921c541856ee76c4a156ac85/invoke.js";
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [profitablerEnabled]);

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.classList.add(
      "engage-native-ad-open"
    );

    return () => {
      document.body.classList.remove(
        "engage-native-ad-open"
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  const close = (
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canClose) return;
    onClose();
  };


  return (
    <div
      className="native-popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Advertisement"
      onClick={close}
    >

      <div
        className="native-popup-card"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >

        {canClose && (
          <button
            type="button"
            className="native-popup-close"
            onClick={close}
            aria-label="Close advertisement"
          >
            <X size={19} />
          </button>
        )}

        <div className="native-square-ad">
          <div
            id="container-aaec7f8a921c541856ee76c4a156ac85"
            className="profitabler-square-container"
          />

          {!canClose && (
            <div className="native-popup-wait">
              Advertisement • Close available in 5 seconds
            </div>
          )}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   NATIVE CORNER AD
   ========================================================= */

export function NativeCornerAd({
  onClose,
}: NativeCornerAdProps) {

  useNativeAdStyles();


  return (
    <div className="native-corner-ad">

      {onClose && (
        <button
          type="button"
          className="native-corner-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            onClose();
          }}
          aria-label="Close corner advertisement"
        >
          <X size={13} />
        </button>
      )}

      <div className="native-corner-square">
        <span>
          ADVERTISEMENT
        </span>
      </div>

      <div className="native-corner-content">

        <small>
          Sponsored
        </small>

        <strong>
          Recommended
        </strong>

        <button
          type="button"
          onClick={() =>
            window.open(
              "https://www.google.com",
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          OPEN
        </button>

      </div>

    </div>
  );
}

export default NativePopup;