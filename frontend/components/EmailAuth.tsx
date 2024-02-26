"use client";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface EmailAuthProps {
  shouldClear: boolean;
  iframeUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-auth-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-auth-iframe-element-id";

export function EmailAuth(props: EmailAuthProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const { shouldClear, iframeUrl, setIframeStamper: setParentIframeStamper } = props;
  const [iframeDisplay, setIframeDisplay] = useState("none");

  useEffect(() => {
    if (!iframeStamper) {
      const iframeStamper = new IframeStamper({
        iframeUrl: iframeUrl,
        iframeContainer: document.getElementById(TurnkeyIframeContainerId),
        iframeElementId: TurnkeyIframeElementId,
      });

      iframeStamper.init().then(() => {
        setIframeStamper(iframeStamper);
        setParentIframeStamper(iframeStamper);
      });
    }

    // Unlike some other components, don't automatically clear the iframestamper if it's present.
    // This is because we want to persist the iframestamper in the case that we've authenticated with email.
    return () => {
      if (iframeStamper && shouldClear) {
        iframeStamper.clear();
        setIframeStamper(null);
        setParentIframeStamper(null);
      }
    };
  }, [shouldClear, iframeUrl, iframeStamper, setIframeStamper, setParentIframeStamper]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code == "KeyI" && e.metaKey == true) {
        if (iframeDisplay == "block") {
          setIframeDisplay("none");
        } else {
          setIframeDisplay("block");
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, false);

    // remove the event listener as a cleanup step
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [iframeDisplay, setIframeDisplay]);

  const iframeCss = `
  iframe {
      width: 100%;
      height: 250px;
  }
  `;

  return (
    <div
      className="space-y-4 p-4 max-w-lg mx-auto"
      style={{ display: iframeDisplay }}
      id={TurnkeyIframeContainerId}
    >
      <style>{iframeCss}</style>
    </div>
  );
}
