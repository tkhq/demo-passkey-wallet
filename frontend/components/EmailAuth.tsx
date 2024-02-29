"use client";
import axios from "axios";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { TurnkeyClient } from "@turnkey/http";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { getItemWithExpiry, TURNKEY_BUNDLE_KEY } from "@/utils/localStorage";
import { turnkeyWhoami } from "@/utils/urls";

interface EmailAuthProps {
  shouldClear: boolean;
  iframeUrl: string;
  setIframeStamper: Dispatch<SetStateAction<IframeStamper | null>>;
}

const TurnkeyIframeContainerId = "turnkey-auth-iframe-container-id";
const TurnkeyIframeElementId = "turnkey-auth-iframe-element-id";

export async function checkIsValid(iframeStamper: IframeStamper, organizationId: string) {
  const client = new TurnkeyClient(
    {
      baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
    },
    iframeStamper
  );

  const signedRequest = await client.stampGetWhoami({
    organizationId,
  });

  // Will throw an error if the credentials are now invalid
  const _whoamiRes = await axios.post(turnkeyWhoami(), {
    signedWhoamiRequest: signedRequest,
  });
}

export async function injectCredentialBundle(iframeStamper: IframeStamper) {
  const bundle = getItemWithExpiry(TURNKEY_BUNDLE_KEY);
  await iframeStamper.injectCredentialBundle(bundle);
}

export function EmailAuth(props: EmailAuthProps) {
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const {
    shouldClear,
    iframeUrl,
    setIframeStamper: setParentIframeStamper,
  } = props;
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
  }, [
    shouldClear,
    iframeUrl,
    iframeStamper,
    setIframeStamper,
    setParentIframeStamper,
  ]);

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
