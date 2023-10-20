"use client";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface RecoveryProps {
  iframeUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-iframe-element-id";

export function Recovery(props: RecoveryProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [iframeDisplay, setIframeDisplay] = useState("none");

  useEffect(() => {
    if (!iframeStamper) {
      // TODO: should this be part of the IframeStamper?
      if (document.getElementById(TurnkeyIframeElementId) !== null) {
        document.getElementById(TurnkeyIframeElementId)?.remove()
      }

      const iframeStamper = new IframeStamper({
        iframeUrl: props.iframeUrl,
        iframeContainerId: TurnkeyIframeContainerId,
        iframeElementId: TurnkeyIframeElementId,
      });
      iframeStamper.init().then(() => {
        setIframeStamper(iframeStamper);
        props.setIframeStamper(iframeStamper);
      });
    }

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
      }
    };
  }, [props, iframeStamper, setIframeStamper]);

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
    document.addEventListener('keydown', handleKeyDown, false);

    // remove the event listener as a cleanup step
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [iframeDisplay, setIframeDisplay]);

  const iframeCss = `
  iframe {
      width: 100%;
      height: 250px;
  }
  `;

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto" style={{ display: iframeDisplay }} id={TurnkeyIframeContainerId}>
          <style>{iframeCss}</style>
    </div>
  )
}
