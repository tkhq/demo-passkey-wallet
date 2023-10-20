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

  return <div style={{ display: "none" }} id={TurnkeyIframeContainerId}></div>;
}
