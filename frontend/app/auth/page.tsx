'use client'

import Image from 'next/image'
import { FederatedRequest, browserInit, getWebAuthnAttestation } from '@turnkey/http'
import axios from 'axios';
import { useForm } from "react-hook-form";
import { authenticateUrl, registerUrl, registrationStatusUrl } from "../../utils/urls"
import { AuthConsumer, useAuth } from '@/components/context/auth.context';
import { useRouter } from 'next/navigation';
import { getWebAuthnAssertion } from '@turnkey/http/dist/webauthn';
import { TPostGetWhoamiInput, federatedPostGetOrganization, federatedPostGetWhoami } from '@turnkey/http/dist/__generated__/services/coordinator/public/v1/public_api.fetcher';
import { useEffect, useState } from 'react';

browserInit({
  baseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL!,
});

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
  const { state, setState } = useAuth();
  const [ willRedirect, setWillRedirect ] = useState(false);
  const router = useRouter();
  
  if (state.isLoggedIn === true) {
    // Redirect the user home if already logged in
    router.push('/');
    return
  }

  useEffect(() => {
    // Force a re-fetch on the next page
    state.isLoaded = false
    setState(state)
  }, [willRedirect])

  const { register: subOrgFormRegister, handleSubmit: subOrgFormSubmit } = useForm<authenticationFormData>();


/**
 * This function looks up whether a given email is registered with Piggybank already
 * If it is registered, a webauthn "get" ceremony takes place.
 * If it isn't, a webauthn "create" ceremony takes place instead.
 * @param data form data from the authentication form.
 */
async function registerOrAuthenticate (data: authenticationFormData) {
  const subOrganizationId = await subOrganizationIdForEmail(data.email);

  if (subOrganizationId !== null) {
    authenticate(subOrganizationId);
  } else {
    signup(data.email)
  }
};

async function subOrganizationIdForEmail(email: string): Promise<string|null> {
  const res = await axios.get(registrationStatusUrl(email));

  // If API returns a non-empty 200, this email maps to an existing Piggybank user.
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
// Piggybank's backend will then forward to Turnkey and get a response on whether the stamp was valid.
// If this is successful, Piggybank will issue a logged in session.
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
    setWillRedirect(true);
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
 * This signup function triggers a webauthn "create" ceremony and POSTs the resulting attestation to Piggybank
 * On the backend, Piggybank uses Turnkey to create a brand new sub-organization with a new private key.
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
        id: "localhost",
        name: "Piggybank",
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
    },
  });

  const res = await axios.post(registerUrl(), {
    email: email,
    attestation,
    challenge: base64UrlEncode(challenge),
  }, { withCredentials: true });
  
  if (res.status === 200) {
    console.log("Successfully registered! Redirecting you to dashboard");
    setWillRedirect(true);
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
        <img className="mx-auto h-32 w-auto" src="/piggybank-logo.png" alt="Piggybank"/>
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-zinc-900">Create or Access your account</h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action="#" method="POST" onSubmit={subOrgFormSubmit(registerOrAuthenticate)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-zinc-900">Email address</label>
            <div className="mt-2">
              <input {...subOrgFormRegister("email")} id="email" name="email" type="email" autoComplete="email" required className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-zinc-900 sm:text-sm sm:leading-6"/>
            </div>
          </div>

          <div>
            <button type="submit" className="flex w-full justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Authenticate with Passkeys</button>
          </div>
        </form>
      </div>
    </div>
  )
}
