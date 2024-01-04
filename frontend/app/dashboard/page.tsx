"use client";

import { BroadcastBanner } from "@/components/BroadcastBanner";
import { Drop } from "@/components/Drop";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import { useAuth } from "@/components/context/auth.context";
import {
  constructTxUrl,
  getSubOrganizationUrl,
  getWalletUrl,
  sendTxUrl,
} from "@/utils/urls";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { AuthWidget } from "@/components/AuthWidget";
import { History } from "@/components/History";
import { Modal } from "@/components/Modal";
import { ExportWallet } from "@/components/ExportWallet";
import { TurnkeyClient } from "@turnkey/http";

type resource = {
  data: any;
};

type sendFormData = {
  destination: string;
  amount: string;
};

const axiosInstance = axios.create({
  withCredentials: true,
});

async function resourceFetcher(url: string): Promise<resource> {
  let response = await axiosInstance.get(url);
  if (response.status === 200) {
    return {
      data: response.data,
    };
  } else {
    // Other status codes indicate an error of some sort
    return {
      data: {},
    };
  }
}

export default function Dashboard() {
  const { state } = useAuth();
  const [disabledSend, setDisabledSend] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const router = useRouter();
  const { register: sendFormRegister, handleSubmit: sendFormSubmit } =
    useForm<sendFormData>();

  const { data: key, error: keyError } = useSWR(
    getWalletUrl(),
    resourceFetcher,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (state.isLoaded === true && state.isLoggedIn === false) {
      // Redirect the user to auth if not logged in
      router.push("/auth");
      return;
    }
  }, [state, router]);

  useEffect(() => {
    if (key && key.data && key.data["balance"] === "0.00") {
      setDisabledSend(true);
    } else {
      setDisabledSend(false);
    }
  }, [key, setDisabledSend]);

  async function sendFormHandler(data: sendFormData) {
    setDisabledSend(true);
    try {
      const constructRes = await axiosInstance.post(constructTxUrl(), {
        amount: data.amount,
        destination: data.destination,
      });

      if (constructRes.status === 200) {
        console.log(
          "Successfully constructed tx: ",
          constructRes.data["unsignedTransaction"]
        );
      } else {
        throw new Error(
          `Unexpected response from tx construction endpoint: ${constructRes.status}: ${constructRes.data}`
        );
      }

      const stamper = new WebauthnStamper({
        rpId: process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!,
      });
      const client = new TurnkeyClient(
        {
          baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
        },
        stamper
      );

      // Now let's sign this!
      const signedTransaction = await client.stampSignTransaction({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        organizationId: constructRes.data["organizationId"],
        timestampMs: Date.now().toString(),
        parameters: {
          signWith: constructRes.data["address"],
          unsignedTransaction: constructRes.data["unsignedTransaction"],
          type: "TRANSACTION_TYPE_ETHEREUM",
        },
      });

      const sendRes = await axiosInstance.post(sendTxUrl(), {
        signedSendTx: signedTransaction,
        destination: data.destination,
      });

      if (sendRes.status === 200) {
        console.log("Successfully sent! Hash", sendRes.data["hash"]);
        setTxHash(sendRes.data["hash"]);
      } else {
        throw new Error(
          `Unexpected response when submitting signed transaction: ${sendRes.status}: ${sendRes.data}`
        );
      }
    } catch (e: any) {
      const msg = `Caught error: ${e.toString()}`;
      console.error(msg);
      alert(msg);
    }

    setDisabledSend(false);
  }

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  if (keyError) {
    console.error("failed to load wallet information:", keyError);
  }

  return (
    <div>
      <header className="bg-zinc-900 p-4 px-8">
        <div className="grid grid-cols-3 flex-none mb-2">
          <div className="col-span-2 mt-4">
            <Image
              className={`inline-block invert`}
              src="/turnkey_logo_black.svg"
              alt="Turnkey Logo"
              width={110}
              height={30}
              priority
            />
          </div>

          <div className="col-span-1">
            <AuthWidget></AuthWidget>
          </div>
        </div>

        <h1 className="favorit text-5xl mt-2 mb-2 text-white">
          Demo passkey wallet
        </h1>
      </header>
      <div className="max-w-5xl mx-auto">
        <BroadcastBanner
          txHash={txHash}
          setTxHash={setTxHash}
        ></BroadcastBanner>

        <section className="lg:bg-subtle-accent p-8 lg:mt-16 lg:border border-zinc-300 divide-y divide-zinc-300">
          <div className="grid grid-cols-5 gap-8 mb-8">
            <div className="col-span-5 lg:col-span-2">
              <h3 className="text-3xl font-medium favorit mb-4">Your wallet</h3>
              <p className="text-destructive-red text-sm mt-1">
                This address is for demo purposes only. Anything sent to this
                address may be lost permanently.
              </p>
            </div>

            <div className="col-auto col-span-5 lg:col-span-3 sm:col-span-5">
              <div className="mb-4">
                <span className="font-semibold mr-2">Address:</span>
                <span className="font-mono">{key && key.data["address"]}</span>
                <br />
                {key ? (
                  <Link
                    className="text-indigo-600 cursor-pointer underline"
                    target="_blank"
                    href={
                      "https://sepolia.etherscan.io/address/" +
                      key.data["address"]
                    }
                  >
                    View on Etherscan{" "}
                    <Image
                      className={`inline-block`}
                      src="/arrow.svg"
                      alt="->"
                      width={20}
                      height={20}
                      priority
                    />
                  </Link>
                ) : null}
                {key && state.subOrganizationId ? (
                  <div>
                    <button
                      className="text-indigo-600 cursor-pointer underline"
                      onClick={openModal}
                    >
                      Export Wallet{" "}
                      <Image
                        className={`inline-block`}
                        src="/export.svg"
                        alt="Export"
                        width={20}
                        height={20}
                        priority
                      />
                    </button>
                    <Modal show={isModalOpen} onClose={closeModal}>
                      <ExportWallet
                        walletId={key.data["turnkeyUuid"]}
                        walletAddress={key.data["address"]}
                        organizationId={state.subOrganizationId!}
                      />
                    </Modal>
                  </div>
                ) : null}
              </div>
              <p>
                <span className="font-semibold mr-2">Balance:</span>
                <span className="font-mono">
                  {key ? key.data["balance"] : "_ . __"} Sepolia ETH
                </span>
                <br />

                {key && key.data["dropsLeft"] !== undefined ? (
                  <Drop
                    dropsLeft={key.data["dropsLeft"] as number}
                    setTxHash={setTxHash}
                  ></Drop>
                ) : null}
              </p>
            </div>
          </div>

          <form
            action="#"
            method="POST"
            onSubmit={sendFormSubmit(sendFormHandler)}
          >
            <div className="grid grid-cols-5 gap-8 my-8">
              <div className="col-span-5 lg:col-span-2">
                <h3 className="text-3xl font-medium favorit mt-2 mb-4">
                  To address
                </h3>
                <p className="text-sm mt-1">
                  Enter the destination for your transaction. By default, you’ll
                  send back to Turnkey’s faucet.
                </p>
              </div>

              <div className="col-auto col-span-5 lg:col-span-3 rounded-sm font-mono">
                <input
                  {...sendFormRegister("destination")}
                  defaultValue="0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7"
                  id="destination"
                  name="destination"
                  type="text"
                  required
                  className="block w-full rounded-md border-0 py-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-8">
              <div className="col-span-5 lg:col-span-2">
                <h3 className="text-3xl font-medium favorit mt-2 mb-4">
                  Amount
                </h3>
                <p className="text-sm">Enter the amount of your transaction.</p>
              </div>

              <div className="col-auto col-span-5 lg:col-span-3 rounded-sm flex h-fit">
                <input
                  {...sendFormRegister("amount")}
                  defaultValue="0.02"
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="block flex-1 rounded-md border-0 py-3 font-mono text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"
                />
                <button
                  type="submit"
                  disabled={disabledSend}
                  className="block flex-none ml-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75"
                >
                  Send
                </button>
              </div>
            </div>
          </form>
        </section>

        <History></History>

        <div className="text-zinc-500 text-center mt-12">
          <Link
            className="underline hover:font-bold font-semibold"
            target="_blank"
            href={"https://docs.turnkey.com/getting-started/sub-organizations"}
            title="Ready to build?"
          >
            Documentation
          </Link>
          {state.subOrganizationId ? (
            <p className="text-sm">
              Did you know? You now have your own Turnkey Organization! Its
              unique ID is {state.subOrganizationId}.
            </p>
          ) : null}
        </div>

        <Footer></Footer>
      </div>
    </div>
  );
}
