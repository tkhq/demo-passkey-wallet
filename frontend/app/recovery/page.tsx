'use client'

import Image from 'next/image'
import { TurnkeyClient, getWebAuthnAttestation } from '@turnkey/http'
import axios from 'axios';
import { useForm } from "react-hook-form";
import { ErrorMessage } from '@hookform/error-message';
import { initEmailRecoveryUrl } from "../../utils/urls"
import { validateAuthenticatorLabel } from "../../utils/validation"
import { useAuth } from '@/components/context/auth.context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IframeStamper } from '@turnkey/iframe-stamper';
import { Recovery } from "@/components/Recovery";

const DEMO_PASSKEY_WALLET_RPID = process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!;

type RecoveryFormData = {
  email: string;
};

type RecoverFormData = {
  bundle: string;
  authenticatorName: string;
};

// Info necessary to perform `RECOVER_USER` activities
type RecoverUserInfo = {
  organizationId: string;
  userId: string;
}

const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

const base64UrlEncode = (challenge: ArrayBuffer): string => {
  return Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

export default function RecoveryPage() {
  const [disabledSubmit, setDisabledSubmit] = useState(false)
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(null);
  const [recoverUserInfo, setRecoverUserInfo] = useState<RecoverUserInfo | null>(null)
  
  const { state } = useAuth();
  const router = useRouter();
  const { register: recoveryFormRegister, handleSubmit: recoveryFormSubmit } = useForm<RecoveryFormData>();
  const { register: recoverFormRegister, formState: recoverFormState, handleSubmit: recoverFormSubmit} = useForm<RecoverFormData>();

  useEffect(() => {
    if (state.isLoggedIn === true) {
      // Redirect the user to their dashboard if already logged in
      router.push('/dashboard');
      return
    }
  }, [router, state])

  /**
   * This function looks up whether a given email is registered with our backend
   * If it is registered, it initializes recovery with Turnkey, which triggers an email
   * If it isn't, an error is returned.
   * @param data form data from the authentication form.
   */
  async function initRecovery(data: RecoveryFormData) {
    if (iframeStamper === null) {
      throw new Error("cannot perform initRecovery without an iframeStamper");
    }
    setDisabledSubmit(true)

    try {
      const res = await axios.post(initEmailRecoveryUrl(), {
        email: data.email,
        targetPublicKey: iframeStamper.publicKey(),
      });
      if (res.status == 200) {
        setRecoverUserInfo({
          userId: res.data["userId"],
          organizationId: res.data["organizationId"]
        })
        setDisabledSubmit(false)
      } else {
        alert("unexpected status: " + res)
      }
    } catch (e: any) {
      if (e.name === "AxiosError" && e["response"]["status"] === 403) {
        alert("no user found for email")
        window.location.reload()
      }
      console.error(e);
    }
  };

  // Performs the new passkey registration, then signs+posts the `RECOVER_USER` activity to Turnkey
  async function recover(data: RecoverFormData) {
    if (iframeStamper === null) {
      throw new Error("iframeStamper is null");
    }
    if (recoverUserInfo === null) {
      throw new Error("recoverUserInfo is null");
    }

    try {
      await iframeStamper.injectRecoveryBundle(data.bundle);
    } catch (e: any){
      throw new Error("unexpected error while injecting recovery bundle: " + e.toString());
    }

    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: DEMO_PASSKEY_WALLET_RPID,
          name: "Demo Passkey Wallet",
        },
        challenge,
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7,
          },
        ],
        user: {
          id: authenticatorUserId,
          name: data.authenticatorName,
          displayName: data.authenticatorName,
        },
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "preferred",
        }
      },
    });

    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
      },
      iframeStamper
    );

    const response = await client.recoverUser({
      type: "ACTIVITY_TYPE_RECOVER_USER",
      timestampMs: String(Date.now()),
      organizationId: recoverUserInfo.organizationId,
      parameters: {
        userId: recoverUserInfo.userId,
        authenticator: {
          authenticatorName: data.authenticatorName,
          challenge: base64UrlEncode(challenge),
          attestation: attestation,
        },
      },
    });

    // There is an interesting edge case here: if we poll using the recovery credential,
    // it will fail as soon as the activity is successful!
    // I think there is a strategy we can implement potentially:
    // - assert that the status of the activity is "PENDING" or "COMPLETE". Anything else should be an error.
    // - on subsequent polls, assert that the status is "PENDING" or that an error "no user found for authenticator" is returned
    // When the error is returned it means the recovery has taken place (the recovery credential has been deleted from org data!)
    // Another solution is to poll this using a read-only API key, from the backend (proxying)
    console.log(response);

    // Instead of simply alerting, redirect the user to your app's login page.
    alert(
      "SUCCESS! Authenticator added. Recovery flow complete. Try logging back in!"
    );
    window.location.replace("/auth")
  }

  return (
    <main className="w-full min-h-screen grid grid-cols-5">
      <div className="hidden lg:block lg:visible lg:col-span-2 bg-black flex-none relative">
        <Image
          className={`inline-block invert my-12 mx-8`}
          src="/turnkey_logo_black.svg"
          alt="->"
          width={110}
          height={30}
          priority
        />
        <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden">
          <div className="gradient-blue"></div>
          <div className="gradient-orange"></div>
        </div>
      </div>

      <div className="col-span-5 lg:col-span-3">
        <div className="mt-48">
          <Image width={80} height={80} className="mx-auto" src="/turnkey.svg" alt="Demo Passkey Wallet Logo"/>
          <h2 className="mt-4 text-center text-3xl favorit leading-9 tracking-tight text-zinc-900">Recover Your Wallet</h2>
        </div>

        <div className="mt-10">
          {!iframeStamper && !recoverUserInfo && (
            <p className="space-y-4 p-4 max-w-lg mx-auto text-center">loading...</p>
          )}
          {iframeStamper && iframeStamper.publicKey() && !recoverUserInfo && (
            <form className="space-y-4 p-4 max-w-lg mx-auto" action="#" method="POST" onSubmit={recoveryFormSubmit(initRecovery)}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium leading-6 text-zinc-900">Email address</label>
                <div className="mt-2">
                  <input {...recoveryFormRegister("email")} disabled={disabledSubmit} placeholder="Enter your email" id="email" name="email" type="email" autoComplete="email" required className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"/>
                </div>
              </div>

              <div>
                <button type="submit" disabled={disabledSubmit} className="w-full justify-center rounded-md bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
                  {
                    disabledSubmit ? "Loading..." : "Start Recovery"
                  }
                </button>
              </div>
            </form>
          )}
          {iframeStamper && iframeStamper.publicKey() && recoverUserInfo && (
            <>
              <div className="space-y-4 p-4 max-w-lg mx-auto text-center text-sm text-green-600 bg-green-100 border-solid border border-green-400">
                <p>An email with your recovery code has been sent. <br/><b>Please do not close this tab before the end of the recovery process</b>.</p>
              </div>
              <form className="space-y-4 p-4 max-w-lg mx-auto" onSubmit={recoverFormSubmit(recover)}>
                <div>
                  <label htmlFor="bundle" className="block text-sm font-medium leading-6 text-zinc-900">Recovery Code</label>
                  <div className="mt-2">
                    <input {...recoverFormRegister("bundle")} placeholder="Enter your recovery code" id="bundle" name="bundle" required className="block w-full rounded-md border-0 p-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"/>
                  </div>
                </div>
                <div>
                  <label htmlFor="authenticatorName" className="block text-sm font-medium leading-6 text-zinc-900">Passkey Name</label>
                  <div className="mt-2">
                    <input {...recoverFormRegister("authenticatorName", { validate: validateAuthenticatorLabel })} placeholder="Name your new passkey" id="authenticatorName" name="authenticatorName" required className="block w-full rounded-md border-0 p-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"/>
                  </div>
                </div>

                <ErrorMessage
                  errors={recoverFormState.errors}
                  name="authenticatorName"
                  render={({ message }) => <p className="text-sm text-red-700">{message}</p>}
                />

                <div>
                  <button type="submit" disabled={disabledSubmit} className="w-full justify-center rounded-md bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
                    {
                      disabledSubmit ? "Loading..." : "Create New Passkey"
                    }
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        <Link className="block w-full text-center mt-4" href={"/"}>Go back home</Link>
      </div>

      <Recovery
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_RECOVERY_IFRAME_URL!}
      ></Recovery>
    </main>
  )
}
