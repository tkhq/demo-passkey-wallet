"use client";

import Image from "next/image";
import { TurnkeyClient, getWebAuthnAttestation } from "@turnkey/http";
import axios from "axios";
import { useForm } from "react-hook-form";
import {
  authenticateUrl,
  registerUrl,
  registrationStatusUrl,
  whoamiUrl,
} from "../../utils/urls";
import { useAuth } from "@/components/context/auth.context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import Link from "next/link";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";

const DEMO_PASSKEY_WALLET_RPID =
  process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!;

console.log("RPID", DEMO_PASSKEY_WALLET_RPID);

type authenticationFormData = {
  email: string;
};

// All algorithms can be found here: https://www.iana.org/assignments/cose/cose.xhtml#algorithms
// We only support ES256, which is listed here
const es256 = -7;

// This constant designates the type of credential we want to create.
// The enum only supports one value, "public-key"
// https://www.w3.org/TR/webauthn-2/#enumdef-publickeycredentialtype
const publicKey = "public-key";

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

export default function Auth() {
  const [disabledSubmit, setDisabledSubmit] = useState(false);
  const { state } = useAuth();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } =
    useForm<authenticationFormData>();

  useEffect(() => {
    if (state.isLoggedIn === true) {
      // Redirect the user to their dashboard if already logged in
      router.push("/dashboard");
      return;
    }
  }, [router, state]);

  /**
   * This function looks up whether a given email is registered with our backend already
   * If it is registered, a webauthn "get" ceremony takes place.
   * If it isn't, a webauthn "create" ceremony takes place instead.
   * @param data form data from the authentication form.
   */
  async function registerOrAuthenticate(data: authenticationFormData) {
    setDisabledSubmit(true);

    try {
      const subOrganizationId = await subOrganizationIdForEmail(data.email);

      if (subOrganizationId !== null) {
        await authenticate(subOrganizationId);
      } else {
        await signup(data.email);
      }
    } catch (e: any) {
      const message = `Caught an error: ${e.toString()}`;
      // TODO: convert to proper UI toast / modal
      alert(message);
      console.error(message);
    }

    setDisabledSubmit(false);
  }

  async function subOrganizationIdForEmail(
    email: string
  ): Promise<string | null> {
    const res = await axios.get(registrationStatusUrl(email));

    // If API returns a non-empty 200, this email maps to an existing user.
    if (res.status == 200) {
      return res.data["subOrganizationId"];
    } else if (res.status === 204) {
      return null;
    } else {
      throw new Error(
        `Unexpected response from registration status endpoint: ${res.status}: ${res.data}`
      );
    }
  }

  // In order to know whether the user is logged in for `subOrganizationId`, we make them sign
  // a request for Turnkey's "whoami" endpoint.
  // The backend will then forward to Turnkey and get a response on whether the stamp was valid.
  // If this is successful, our backend will issue a logged in session.
  async function authenticate(subOrganizationId: string) {
    const stamper = new WebauthnStamper({
      rpId: process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!,
    });
    const client = new TurnkeyClient(
      {
        baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
      },
      stamper
    );

    var signedRequest;
    try {
      signedRequest = await client.stampGetWhoami({
        organizationId: subOrganizationId,
      });
    } catch (e) {
      throw new Error(`Error during webauthn prompt: ${e}`);
    }

    const res = await axios.post(
      authenticateUrl(),
      {
        signedWhoamiRequest: signedRequest,
      },
      { withCredentials: true }
    );

    if (res.status === 200) {
      console.log("Successfully logged in! Redirecting you to dashboard");
      mutate(whoamiUrl());
      router.push("/dashboard");
      return;
    } else {
      throw new Error(
        `Unexpected response from authentication endpoint: ${res.status}: ${res.data}`
      );
    }
  }

  /**
   * This signup function triggers a webauthn "create" ceremony and POSTs the resulting attestation to the backend
   * The backend uses Turnkey to create a brand new sub-organization with a new private key.
   * @param email user email
   */
  async function signup(email: string) {
    const challenge = generateRandomBuffer();
    const authenticatorUserId = generateRandomBuffer();

    // An example of possible options can be found here:
    // https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
    const attestation = await getWebAuthnAttestation({
      publicKey: {
        rp: {
          id: DEMO_PASSKEY_WALLET_RPID,
          name: "Demo Passkey Wallet",
        },
        challenge,
        pubKeyCredParams: [
          {
            type: publicKey,
            alg: es256,
          },
        ],
        user: {
          id: authenticatorUserId,
          name: email,
          displayName: email,
        },
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "preferred",
        },
      },
    });

    const res = await axios.post(
      registerUrl(),
      {
        email: email,
        attestation,
        challenge: base64UrlEncode(challenge),
      },
      { withCredentials: true }
    );

    if (res.status === 200) {
      console.log("Successfully registered! Redirecting you to dashboard");
      mutate(whoamiUrl());
      router.push("/dashboard");
      return;
    } else {
      throw new Error(
        `Unexpected response from registration endpoint: ${res.status}: ${res.data}`
      );
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
            Create or access your account
          </h2>
        </div>

        <div className="mt-10">
          <form
            className="space-y-4 p-4 max-w-lg mx-auto"
            action="#"
            method="POST"
            onSubmit={subOrgFormSubmit(registerOrAuthenticate)}
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
                  {...subOrgFormRegister("email")}
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
                {disabledSubmit ? "Loading..." : "Authenticate with Passkeys"}
              </button>
            </div>
          </form>

          <div className="px-4 max-w-lg mx-auto flex justify-center space-x-2">
            <button className="w-full justify-center rounded-md bg-gray-200 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
              <Link href={"/recovery"}>Recover your wallet</Link>
            </button>
            <button className="w-full justify-center rounded-md bg-gray-200 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
              <Link href={"/email-auth"}>Log in with email</Link>
            </button>
          </div>
        </div>
        <Link
          className="block w-full text-center mt-6"
          href={"/"}
        >
          Go back home
        </Link>
      </div>
    </main>
  );
}
