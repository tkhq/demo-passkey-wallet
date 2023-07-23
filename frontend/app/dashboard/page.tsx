'use client'

import { BroadcastBanner } from '@/components/BroadcastBanner';
import { Drop } from '@/components/Drop';
import { Nav } from '@/components/Nav';
import { useAuth } from '@/components/context/auth.context';
import { constructTxUrl, getSubOrganizationUrl, getWalletUrl, sendTxUrl } from '@/utils/urls';
import { browserInit } from '@turnkey/http';
import { TPostSignTransactionInput, federatedPostSignTransaction } from '@turnkey/http/dist/__generated__/services/coordinator/public/v1/public_api.fetcher';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';

browserInit({
  baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
});

type resource = {
  data: any,
}

type sendFormData = {
  destination: string,
  amount: string,
};

async function resourceFetcher(url: string): Promise<resource> {
  let response = await axios.get(url, {withCredentials: true})
  if (response.status === 200) {
      return {
          data: response.data,
      }
  } else {
      // Other status codes indicate an error of some sort
      return {
        data: {}
      }
  }
}


export default function Dashboard() {
  const { state } = useAuth();
  const [disabledSend, setDisabledSubmit] = useState(false);
  const [txHash, setTxHash] = useState("");

  const router = useRouter();
  const { register: sendFormRegister, handleSubmit: sendFormSubmit } = useForm<sendFormData>();

  const { data: key, error: keyError, isValidating: isRefetchingKey } = useSWR(getWalletUrl(), resourceFetcher, { refreshInterval: 4000 })

  useEffect(() => {
    if (state.isLoaded === true && state.isLoggedIn === false) {
      // Redirect the user to auth if not logged in
      router.push('/auth');
      return
    }
  }, [state, router])

  async function sendFormHandler (data: sendFormData) {
    setDisabledSubmit(true)

    const constructRes = await axios.post(constructTxUrl(), {
      amount: data.amount,
      destination: data.destination,
    }, { withCredentials: true });

    if (constructRes.status === 200) {
      console.log("Successfully constructed tx: ", constructRes.data["unsignedTransaction"]);
    } else {
      const msg = `Unexpected response: ${constructRes.status}: ${constructRes.data}`;
      console.error(msg)
      alert(msg)
      setDisabledSubmit(false)
      return
    }

    // Now let's sign this!
    const signTransactionInput: TPostSignTransactionInput = {
      body: {
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
        organizationId: constructRes.data["organizationId"],
        timestampMs: Date.now().toString(),
        parameters: {
          privateKeyId: constructRes.data["privateKeyId"],
          unsignedTransaction: constructRes.data["unsignedTransaction"],
          type: "TRANSACTION_TYPE_ETHEREUM"
        }
      }
    }
    const signedRequest = await federatedPostSignTransaction(signTransactionInput);

    const sendRes = await axios.post(sendTxUrl(), {
      signedSendTx: signedRequest,
      destination: data.destination,
    }, { withCredentials: true });

    if (sendRes.status === 200) {
      console.log("Successfully sent! Hash", sendRes.data["hash"]);
      setTxHash(sendRes.data["hash"])
    } else {
      const msg = `Unexpected response: ${sendRes.status}: ${sendRes.data}`;
      console.error(msg)
      alert(msg)
      setDisabledSubmit(false)
      return
    }
    setDisabledSubmit(false)
  };

  if (keyError) {
    console.error("failed to load wallet information:", keyError)
  };

  return (
    <div>
      <Nav></Nav>
      <BroadcastBanner txHash={txHash} setTxHash={setTxHash}></BroadcastBanner>

      <div className="grid grid-cols-5 gap-8 my-8 m-8 border-b pb-8">
        <div className="col-span-2">
          <h3 className="text-xl font-medium">Ethereum Network</h3>
          <p className="text-destructive-red text-sm mt-1">
            This address is for demo purposes only. Anything sent to this address may be lost permanently.
          </p>
        </div>

        <div className="col-auto col-span-3 bg-subtle-accent p-4 text-sm rounded-md">
          <p className="mb-4">
            <span className="font-semibold mr-2">Address:</span>
            <span className="font-mono">{key && key.data["address"]}</span>
            <br/>
            {key ? <Link className="text-indigo-600 cursor-pointer" target="_blank" href={"https://sepolia.etherscan.io/address/" + key.data["address"]}>View on Etherscan &#128279;</Link> : null }
          </p>
          <p>
            <span className="font-semibold mr-2">Balance:</span>
            <span>{key ? key.data["balance"] : "_ . __"} Sepolia ETH</span>
            <br/>

            { key && key.data["dropsLeft"] !== undefined ? 
              <Drop dropsLeft={key.data["dropsLeft"] as number}></Drop>
              : null
            }

          </p>
        </div>
      </div>

      <form className="space-y-6" action="#" method="POST" onSubmit={sendFormSubmit(sendFormHandler)}>
        <div className="grid grid-cols-5 gap-8 my-8 m-8 border-b pb-8">
          <div className="col-span-2">
            <h3 className="text-xl font-medium">To address</h3>
            <p className="text-sm mt-1">
              Enter the destination for your transaction.<br/>
              Feeling generous? Send back to Turnkey&apos;s faucet address (leave this input alone)
            </p>
          </div>

          <div className="col-auto col-span-3 p-4 text-sm rounded-sm font-mono">
            <input {...sendFormRegister("destination")} disabled={disabledSend} defaultValue="0x08d2b0a37F869FF76BACB5Bab3278E26ab7067B7" id="destination" name="destination" type="text" required className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 sm:text-sm sm:leading-6 disabled:opacity-75 disabled:text-zinc-400"/>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-8 my-8 m-8 border-b pb-8">
          <div className="col-span-2">
            <h3 className="text-xl font-medium">Amount</h3>
            <p className="text-sm mt-1">
              Enter the amount of Sepolia Ethereum you would like to send.
            </p>
          </div>

          <div className="col-auto col-span-3 p-4 text-sm rounded-sm">
            <input {...sendFormRegister("amount")} disabled={disabledSend} defaultValue="0.05" id="amount" name="amount" type="number" min="0" step="0.01" required className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 sm:text-sm sm:leading-6 disabled:opacity-75 disabled:text-zinc-400"/>
          </div>
        </div>
        <div className="text-right">
        <button type="submit" disabled={disabledSend} className="inline-block mx-12 my-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
          {
            disabledSend ? "Sending..." : "Send"
          }
        </button>
        </div>
      </form>

      <div className="text-zinc-500 text-center font-semibold mt-12">
        <Link className="underline hover:font-bold" target="_blank" href={"https://turnkey.readme.io/reference/getting-started"} title="Ready to build?">
          Documentation
        </Link>
        {' '}|{' '}
        <Link className="underline hover:font-bold" target="_blank" href={getSubOrganizationUrl()} title="Did you know? You are the owner of a completely independent Turnkey Sub-Organization!">
          Sub-Org Details
        </Link>
      </div>
    </div>
  )
}
