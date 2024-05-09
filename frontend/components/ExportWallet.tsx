"use client";

import { TurnkeyClient } from "@turnkey/http";
import axios from "axios";
import { exportWalletUrl } from "../utils/urls";
import { useEffect, useState } from "react";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { Export } from "@/components/Export";
import Link from "next/link";

type ExportWalletProps = {
  walletId: string;
  walletAddress: string;
  organizationId: string;
};

export function ExportWallet(props: ExportWalletProps) {
  const [iframeDisplay, setIframeDisplay] = useState("none");
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [agreements, setAgreements] = useState({
    agreement1: false,
    agreement2: false,
    agreement3: false,
    agreement4: false,
  });
  const [disabledReveal, setDisabledReveal] = useState(true);

  const handleAgreementChange = (event: {
    target: { id: any; checked: any };
  }) => {
    const { id, checked } = event.target;
    setAgreements((prev) => ({
      ...prev,
      [id]: checked,
    }));
  };

  useEffect(() => {
    const allChecked = Object.values(agreements).every(Boolean);
    setDisabledReveal(!allChecked);
  }, [agreements]);

  useEffect(() => {
    setIframeDisplay("none");
  }, []);

  async function exportWallet() {
    if (iframeStamper === null) {
      throw new Error("cannot perform export without an iframeStamper");
    }

    const webauthnStamper = new WebauthnStamper({
      rpId: process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!,
    });

    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
      },
      webauthnStamper
    );

    const signedRequest = await client.stampExportWallet({
      type: "ACTIVITY_TYPE_EXPORT_WALLET",
      timestampMs: String(Date.now()),
      organizationId: props.organizationId,
      parameters: {
        walletId: props.walletId,
        targetPublicKey: iframeStamper.publicKey()!,
      },
    });

    const res = await axios.post(exportWalletUrl(), {
      signedExportRequest: signedRequest,
    });

    if (res.status === 200) {
      try {
        await iframeStamper.injectWalletExportBundle(res.data);
        setIframeDisplay("block");
      } catch (e: any) {
        throw new Error(
          "unexpected error while injecting wallet export bundle: " + e.toString()
        );
      }
    }
  }

  return (
    <div className="w-full min-h-export-modal">
      <div>
        {!iframeStamper ? (
          <p className="space-y-4 max-w-lg mx-auto text-center">loading...</p>
        ) : iframeStamper && iframeDisplay == "block" ? (
          <div className="text-center px-6 py-4">
            <h2 className="text-lg md:text-2xl font-semibold">
              Wallet private key
            </h2>
            <p className="px-4 pt-2">
              Store this in a secure place and do not share it with anyone,
              including Turnkey.
            </p>
          </div>
        ) : (
          <div className="text-center px-6 py-4">
            <h2 className="text-lg md:text-2xl font-semibold">
              Before you continue
            </h2>
            <p className="px-4 py-2">
              By revealing the private key for{" "}
              <span className="font-mono text-gray-800">
                {props.walletAddress}
              </span>{" "}
              you understand and agree that:
            </p>
            <ul className="space-y-2 mt-4 text-sm">
              <li key="agreement1" className="flex items-start py-4">
                <input
                  type="checkbox"
                  id="agreement1"
                  checked={agreements["agreement1"]}
                  onChange={handleAgreementChange}
                  className="w-4 h-4 text-zinc-600 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2"
                />
                <label htmlFor="agreement1" className="text-justify px-4">
                  You should never share your private key with anyone, including
                  the Turnkey team. Turnkey will never ask you for your private
                  key.
                </label>
              </li>
              <li key="agreement2" className="flex items-start py-4">
                <input
                  type="checkbox"
                  id="agreement2"
                  checked={agreements["agreement2"]}
                  onChange={handleAgreementChange}
                  className="w-4 h-4 text-zinc-600 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2"
                />
                <label htmlFor="agreement2" className="text-justify px-4">
                  You are responsible for the security of this private key and
                  any assets associated with it, and Turnkey cannot help recover
                  it on your behalf. Failure to properly secure your private key
                  may result in total loss of the associated assets.
                </label>
              </li>
              <li key="agreement3" className="flex items-start py-4">
                <input
                  type="checkbox"
                  id="agreement3"
                  checked={agreements["agreement3"]}
                  onChange={handleAgreementChange}
                  className="w-4 h-4 text-zinc-600 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2"
                />
                <label htmlFor="agreement3" className="text-justify px-4">
                  Turnkey is not responsible for any other wallet you may use
                  with this private key, and Turnkey does not represent that any
                  other software or hardware will be compatible with or protect
                  your private key.
                </label>
              </li>
              <li key="agreement4" className="flex items-start py-4">
                <input
                  type="checkbox"
                  id="agreement4"
                  checked={agreements["agreement4"]}
                  onChange={handleAgreementChange}
                  className="w-4 h-4 text-zinc-600 bg-gray-100 border-gray-300 rounded focus:ring-zinc-500 focus:ring-2"
                />
                <label htmlFor="agreement3" className="text-justify px-4">
                  You have read and agree to{" "}
                  <Link
                    className="text-indigo-600 cursor-pointer underline"
                    target="_blank"
                    href="https://www.turnkey.com/files/terms-of-service.pdf"
                  >
                    Turnkey{"'"}s Terms of Service
                  </Link>
                  , including the risks related to exporting your private key
                  disclosed therein.
                </label>
              </li>
            </ul>
            <div className="flex justify-center items-center mt-6">
              <button
                disabled={disabledReveal}
                className="block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75"
                onClick={() => exportWallet()}
              >
                Reveal private key
              </button>
            </div>
          </div>
        )}
      </div>

      <Export
        setIframeStamper={setIframeStamper}
        iframeDisplay={iframeDisplay}
        iframeUrl={process.env.NEXT_PUBLIC_EXPORT_IFRAME_URL!}
      ></Export>
    </div>
  );
}
