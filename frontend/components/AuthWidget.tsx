"use client";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./context/auth.context";
import axios from "axios";
import { logoutUrl, whoamiUrl } from "@/utils/urls";
import { useSWRConfig } from "swr";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { TURNKEY_BUNDLE_KEY } from "@/utils/localStorage";

interface AuthWidgetProps {
  setShouldClearIframe?: Dispatch<SetStateAction<boolean>>;
}

export function AuthWidget(props: AuthWidgetProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { state } = useAuth();
  const pathName = usePathname();
  const { setShouldClearIframe } = props;

  const handleLogout = async () => {
    if (confirm("You are about to log out. Continue?") === true) {
      // Clear local storage of any credentials/auth bundles
      window.localStorage.removeItem(TURNKEY_BUNDLE_KEY);
      if (setShouldClearIframe) {
        setShouldClearIframe(true);
      }

      const res = await axios.post(logoutUrl(), {}, { withCredentials: true });
      if (res.status !== 204) {
        // We expect a 204 (no content) response from our backend
        console.error("error while logging you out: ", res);
      } else {
        mutate(whoamiUrl());
        // Redirect home
        router.push("/");
        return;
      }
    }

    // Confirm clearance of local storage
    window.localStorage.removeItem(TURNKEY_BUNDLE_KEY);
  };

  if (state.isLoaded) {
    if (state.isLoggedIn === true) {
      if (pathName !== "/dashboard") {
        return (
          <div className="text-right pt-1">
            <a
              href="/dashboard"
              className="inline-block rounded-md bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Dashboard
            </a>
            <button
              onClick={handleLogout}
              className="inline-block ml-2 rounded-md bg-white px-6 py-3 text-center text-sm font-semibold text-destructive-red shadow-sm hover:bg-destructive-red hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Sign out
            </button>
            <p className="mt-2 text-xs leading-5 text-zinc">
              Signed in as {state.email}
            </p>
          </div>
        );
      } else {
        return (
          <div className="text-right pt-1">
            <button
              onClick={handleLogout}
              className="inline-block ml-2 rounded-md bg-white px-6 py-3 text-center text-sm font-semibold text-destructive-red shadow-sm hover:bg-destructive-red hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Sign out
            </button>
            <p className="mt-2 text-xs leading-5 text-white">
              Signed in as {state.email}
            </p>
          </div>
        );
      }
    } else {
      return (
        <div className="mt-2 text-right">
          <a
            href="/auth"
            className="inline-block rounded-md bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:transparency:75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Sign In
          </a>
        </div>
      );
    }
  } else {
    return (
      <div className="mt-2 text-right font-bold">
        <p className="inline-block px-6 py-3 text-center text-sm">Loading...</p>
      </div>
    );
  }
}
