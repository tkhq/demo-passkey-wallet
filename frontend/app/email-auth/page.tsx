"use client";

import Image from "next/image";
import { TurnkeyClient, getWebAuthnAttestation } from "@turnkey/http";
import axios from "axios";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import { useSWRConfig } from "swr";
import {
  authenticateUrl,
  emailAuthUrl,
  turnkeyWhoami,
  whoamiUrl,
} from "../../utils/urls";
import { validateAuthenticatorLabel } from "../../utils/validation";
import { useAuth } from "@/components/context/auth.context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { EmailAuth } from "@/components/EmailAuth";

const DEMO_PASSKEY_WALLET_RPID =
  process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!;

// kick off email auth
type InitEmailAuthFormData = {
  email: string;
};

// inject email auth bundle
type EmailAuthFormData = {
  bundle: string;
};

// Info necessary to perform `EMAIL_AUTH` activities
type EmailAuthUserInfo = {
  organizationId: string;
  userId: string;
  apiKeyId: string;
};

export default function EmailAuthPage() {
  const [disabledSubmit, setDisabledSubmit] = useState(false);
  const [iframeStamper, setIframeStamper] = useState<IframeStamper | null>(
    null
  );
  const [emailAuthUserInfo, setEmailAuthUserInfo] =
    useState<EmailAuthUserInfo | null>(null);
  const { state } = useAuth();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const {
    register: initEmailAuthFormRegister,
    handleSubmit: initEmailAuthFormSubmit,
  } = useForm<InitEmailAuthFormData>();
  const {
    register: emailAuthFormRegister,
    formState: emailAuthFormState,
    handleSubmit: emailAuthFormSubmit,
  } = useForm<EmailAuthFormData>();

  useEffect(() => {
    // can probably check if local storage contains auth bundle
    if (state.isLoggedIn === true) {
      // Redirect the user to their dashboard if already logged in
      router.push("/dashboard");
      return;
    }
  }, [router, state]);

  /**
   * This function looks up whether a given email is registered with our backend
   * If it is registered, it initializes email auth with Turnkey, which triggers an email.
   * If it isn't, an error is returned.
   * @param data form data from the authentication form.
   */
  async function initEmailAuth(data: InitEmailAuthFormData) {
    if (iframeStamper === null) {
      throw new Error("cannot perform initEmailAuth without an iframeStamper");
    }
    setDisabledSubmit(true);

    try {
      const res = await axios.post(emailAuthUrl(), {
        email: data.email,
        targetPublicKey: iframeStamper.publicKey(),
      });
      if (res.status == 200) {
        setEmailAuthUserInfo({
          userId: res.data["userId"],
          apiKeyId: res.data["apiKeyId"],
          organizationId: res.data["organizationId"],
        });
        setDisabledSubmit(false);
      } else {
        alert("unexpected status: " + res);
      }
    } catch (e: any) {
      if (e.name === "AxiosError" && e["response"]["status"] === 403) {
        alert("no user found for email");
        window.location.reload();
      }
      console.error(e);
    }
  }

  // NOTE: for email auth, this can really be any arbitrary activity, like creating a wallet/performing whoami/etc
  async function injectBundle(data: EmailAuthFormData) {
    if (iframeStamper === null) {
      throw new Error("iframeStamper is null");
    }
    if (emailAuthUserInfo === null) {
      throw new Error("emailAuthUserInfo is null");
    }

    // TODO: do something with the bundle, and/or the iframestamper.
    // set the bundle in local storage?
    try {
      await iframeStamper.injectCredentialBundle(data.bundle);

      // Note: this comes with associated risk.
      setItemWithExpiry(
        "AUTH_BUNDLE",
        data.bundle,
        TURNKEY_EMBEDDED_KEY_TTL_IN_MILLIS
      );
    } catch (e: any) {
      throw new Error(
        "unexpected error while injecting auth bundle: " + e.toString()
      );
    }

    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
      },
      iframeStamper
    );

    // An example request that can be signed using the iframe stamper
    const signedRequest = await client.stampGetWhoami({
      organizationId: emailAuthUserInfo.organizationId,
    });

    const whoamiRes = await axios.post(turnkeyWhoami(), {
      signedWhoamiRequest: signedRequest,
    });

    // OR you can make the request directly
    const whoami = await client.getWhoami({
      organizationId: emailAuthUserInfo.organizationId,
    });

    // save session in backend
    const res = await axios.post(
      authenticateUrl(),
      {
        signedWhoamiRequest: signedRequest,
      },
      { withCredentials: true }
    );

    if (res.status === 200) {
      alert(
        `SUCCESS! You are now authenticated. Redirecting you to dashboard. Your suborg ID: ${whoami.organizationId}`
      );
      // window.location.replace("/auth"); // redirect to dashboard
      mutate(whoamiUrl());
      router.push("/dashboard");
      return;
    } else {
      console.error(
        "unable to forward signed whoami request to Turnkey: status code is " +
          res.status
      );
      console.error(res);
    }
  }

  return (
    <main className="w-full min-h-screen grid grid-cols-5">
      <div className="hidden lg:block lg:visible lg:col-span-2 bg-black flex-none relative">
        <Image
          className={`inline-block invert my-12 mx-8`}
          src="/turnkey_logo_black.svg"
          alt="Turnkey Logo"
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
          <Image
            width={80}
            height={80}
            className="mx-auto"
            src="/turnkey.svg"
            alt="Demo Passkey Wallet Logo"
          />
          <h2 className="mt-4 text-center text-3xl favorit leading-9 tracking-tight text-zinc-900">
            Log in with email
          </h2>
        </div>

        <div className="mt-10">
          {!iframeStamper && !emailAuthUserInfo && (
            <p className="space-y-4 p-4 max-w-lg mx-auto text-center">
              loading...
            </p>
          )}
          {iframeStamper && iframeStamper.publicKey() && !emailAuthUserInfo && (
            <form
              className="space-y-4 p-4 max-w-lg mx-auto"
              action="#"
              method="POST"
              onSubmit={initEmailAuthFormSubmit(initEmailAuth)}
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium leading-6 text-zinc-900"
                >
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    {...initEmailAuthFormRegister("email")}
                    disabled={disabledSubmit}
                    placeholder="Enter your email"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={disabledSubmit}
                  className="w-full justify-center rounded-md bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75"
                >
                  {disabledSubmit ? "Loading..." : "Log in with Email"}
                </button>
              </div>
            </form>
          )}
          {iframeStamper && iframeStamper.publicKey() && emailAuthUserInfo && (
            <>
              <div className="space-y-4 p-4 max-w-lg mx-auto text-center text-sm text-green-600 bg-green-100 border-solid border border-green-400">
                <p>
                  An email with your auth code has been sent. <br />
                  <b>
                    Please do not close this tab before the end of the auth
                    process
                  </b>
                  .
                </p>
              </div>
              <form
                className="space-y-4 p-4 max-w-lg mx-auto"
                onSubmit={emailAuthFormSubmit(injectBundle)}
              >
                <div>
                  <label
                    htmlFor="bundle"
                    className="block text-sm font-medium leading-6 text-zinc-900"
                  >
                    Auth Bundle
                  </label>
                  <div className="mt-2">
                    <input
                      {...emailAuthFormRegister("bundle")}
                      placeholder="Enter your auth bundle"
                      id="bundle"
                      name="bundle"
                      required
                      className="block w-full rounded-md border-0 p-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={disabledSubmit}
                    className="w-full justify-center rounded-md bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75"
                  >
                    {disabledSubmit ? "Loading..." : "Who Am I?"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        <Link className="block w-full text-center mt-4" href={"/"}>
          Go back home
        </Link>
      </div>

      <EmailAuth
        setIframeStamper={setIframeStamper}
        iframeUrl={process.env.NEXT_PUBLIC_AUTH_IFRAME_URL!}
      ></EmailAuth>
    </main>
  );
}

const TURNKEY_EMBEDDED_KEY_TTL_IN_MILLIS = 1000 * 60 * 60 * 1; // 1 hour in milliseconds

/**
 * Set an item in localStorage with an expiration time
 * @param {string} key
 * @param {string} value
 * @param {number} ttl expiration time in milliseconds
 */
const setItemWithExpiry = function (key: string, value: string, ttl: number) {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttl,
  };
  window.localStorage.setItem(key, JSON.stringify(item));
};

/**
 * Get an item from localStorage. If it has expired, remove
 * the item from localStorage and return null.
 * @param {string} key
 */
const getItemWithExpiry = (key: string) => {
  const itemStr = window.localStorage.getItem(key);

  if (!itemStr) {
    return null;
  }

  const item = JSON.parse(itemStr);

  if (!item.hasOwnProperty("expiry") || !item.hasOwnProperty("value")) {
    window.localStorage.removeItem(key);
    return null;
  }

  const now = new Date();
  if (now.getTime() > item.expiry) {
    window.localStorage.removeItem(key);
    return null;
  }
  return item.value;
};
