'use client'
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './context/auth.context';
import axios from 'axios';
import { logoutUrl, whoamiUrl } from '@/utils/urls';
import { useSWRConfig } from 'swr';

export function AuthWidget() {
    const router = useRouter();
    const { mutate } = useSWRConfig()
    const { state } = useAuth()
    const pathName = usePathname()

    const handleLogout = async () => {
        if (confirm("You are about to log out. Continue?") === true) {
            const res = await axios.post(logoutUrl(), {}, { withCredentials: true });
            if (res.status !== 204) {
                // We expect a 204 (no content) response from our backend
                console.error("error while logging you out: ", res);
            } else {
                mutate(whoamiUrl())
                // Redirect home
                router.push("/")
                return
            }
        }
    }

    if (state.isLoaded) {
        if (state.isLoggedIn === true) {
            return <div className="text-right pt-1">
                {
                    pathName !== "/dashboard" ?
                    <a href="/dashboard" className="inline-block rounded-md bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                        Dashboard
                    </a>
                    : ''
                }
                <button onClick={handleLogout} className="inline-block ml-2 rounded-md bg-white px-6 py-3 text-center text-sm font-semibold text-destructive-red shadow-sm hover:bg-destructive-red hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    Sign out
                </button>
                <p className="mt-2 text-xs leading-5 text-white">Signed in as {state.email}</p>
            </div>;
        } else {
            return <div className="mt-2 text-right">
                <a href="/auth" className="inline-block rounded-md bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm hover:transparency:75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Sign In</a>
            </div>
        }
    } else {
        return <div className="mt-2 text-right font-bold">
        <p className="inline-block px-6 py-3 text-center text-sm">Loading...</p>
    </div>
    }
 }