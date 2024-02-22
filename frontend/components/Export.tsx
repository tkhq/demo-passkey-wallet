"use client";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface ExportProps {
  iframeUrl: string;
  iframeDisplay: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-export-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-export-iframe-element-id";

export function Export(props: ExportProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const iframeUrl = props.iframeUrl;
  const setParentIframeStamper = props.setIframeStamper;

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

    return () => {
      if (iframeStamper) {
        iframeStamper.clear();
        setIframeStamper(null);
        setParentIframeStamper(null);
      }
    };
  }, [iframeUrl, iframeStamper, setIframeStamper, setParentIframeStamper]);

  const iframeCss = `
  iframe {
      width: 100%;
      height: 340px;
  }
  `;

  return (
    <div
      className="space-y-4 p-4 max-w-lg m-auto"
      style={{ display: props.iframeDisplay }}
      id={TurnkeyIframeContainerId}
    >
      <style>{iframeCss}</style>
    </div>
  );
}
