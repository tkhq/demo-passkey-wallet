'use client'

import Image from 'next/image'
import { browserInit, getWebAuthnAttestation } from '@turnkey/http'
import axios from 'axios';
import { useForm } from "react-hook-form";
import { authenticateUrl, registerUrl, registrationStatusUrl, whoamiUrl } from "../../utils/urls"
import { useAuth } from '@/components/context/auth.context';
import { useRouter } from 'next/navigation';
import { TPostGetWhoamiInput, federatedPostGetWhoami } from '@turnkey/http/dist/__generated__/services/coordinator/public/v1/public_api.fetcher';
import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import Link from 'next/link';

browserInit({
  baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
});

const DEMO_PASSKEY_WALLET_RPID = process.env.NEXT_PUBLIC_DEMO_PASSKEY_WALLET_RPID!;

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
  const [disabledSubmit, setDisabledSubmit] = useState(false)
  const { state } = useAuth();
  const router = useRouter();
  const { mutate } = useSWRConfig()

  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } = useForm<authenticationFormData>();

  useEffect(() => {
    if (state.isLoggedIn === true) {
      // Redirect the user to their dashboard if already logged in
      router.push('/dashboard');
      return
    }
  }, [router, state])

/**
 * This function looks up whether a given email is registered with our backend already
 * If it is registered, a webauthn "get" ceremony takes place.
 * If it isn't, a webauthn "create" ceremony takes place instead.
 * @param data form data from the authentication form.
 */
async function registerOrAuthenticate (data: authenticationFormData) {
  setDisabledSubmit(true)
  const subOrganizationId = await subOrganizationIdForEmail(data.email);

  if (subOrganizationId !== null) {
    authenticate(subOrganizationId);
  } else {
    signup(data.email)
  }
};

async function subOrganizationIdForEmail(email: string): Promise<string|null> {
  const res = await axios.get(registrationStatusUrl(email));

  // If API returns a non-empty 200, this email maps to an existing user.
  if (res.status == 200) {
    return res.data["subOrganizationId"]
  } else if (res.status === 204) {
    return null
  } else {
    // TODO: convert to toast?
    alert("error while fetching subOrg ID for email!")
    return null
  }
}

// In order to know whether the user is logged in for `subOrganizationId`, we make them sign
// a request for Turnkey's "whoami" endpoint.
// The backend will then forward to Turnkey and get a response on whether the stamp was valid.
// If this is successful, our backend will issue a logged in session.
async function authenticate(subOrganizationId: string) {
  const whoamiInput: TPostGetWhoamiInput = {
    body: {
      organizationId: subOrganizationId,
    }
  }
  const signedWhoamiRequest = await federatedPostGetWhoami(whoamiInput);

  const res = await axios.post(authenticateUrl(), {
    signedWhoamiRequest: signedWhoamiRequest,
  }, { withCredentials: true });

  if (res.status === 200) {
    console.log("Successfully logged in! Redirecting you to dashboard");
    mutate(whoamiUrl())
    router.push("/dashboard")
    return
  } else {
    const msg = `Unexpected response: ${res.status}: ${res.data}`;
    console.error(msg)
    alert(msg)
    return
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
      }
    },
  });

  const res = await axios.post(registerUrl(), {
    email: email,
    attestation,
    challenge: base64UrlEncode(challenge),
  }, { withCredentials: true });
  
  if (res.status === 200) {
    console.log("Successfully registered! Redirecting you to dashboard");
    mutate(whoamiUrl())
    router.push("/dashboard")
    return
  } else {
    const msg = `Unexpected response: ${res.status}: ${res.data}`;
    console.error(msg)
    alert(msg)
    return
  }
}

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <Image width={200} height={200} className="mx-auto h-32 w-auto" src="/turnkey.svg" alt="Demo Passkey Wallet Logo"/>
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-zinc-900">Create or Access your account</h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action="#" method="POST" onSubmit={subOrgFormSubmit(registerOrAuthenticate)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-zinc-900">Email address</label>
            <div className="mt-2">
              <input {...subOrgFormRegister("email")} disabled={disabledSubmit} id="email" name="email" type="email" autoComplete="email" required className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 disabled:opacity-75 disabled:text-zinc-400"/>
            </div>
          </div>

          <div>
            <button type="submit" disabled={disabledSubmit} className="flex w-full justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:hover:bg-zinc-900 disabled:opacity-75">
              {
                disabledSubmit ? "Loading..." : "Authenticate with Passkeys"
              }
            </button>
          </div>
        </form>
      </div>
      <Link className="block w-full text-center mt-12" href={"/"}>Go back home</Link>
    </div>
  )
}
