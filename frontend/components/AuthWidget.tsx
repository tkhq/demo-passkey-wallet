'use client'
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './context/auth.context';
import axios from 'axios';
import { logoutUrl, registerUrl } from '@/utils/urls';

export function AuthWidget() {
    const router = useRouter();
    const handleLogout = async () => {
        if (confirm("You are about to log out. Continue?") === true) {
            const res = await axios.post(logoutUrl(), {}, { withCredentials: true });
            if (res.status !== 204) {
                // We expect a 204 (no content) response from our backend
                console.error("error while logging you out: ", res);
            } else {
                // Redirect home
                router.push("/")
                return
            }
        }
    }

    const { state } = useAuth()

    const pathname = usePathname();
    if (state.isLoaded) {
        if (state.isLoggedIn === true) {
            return <div className="mb-12 lg:min-w-[250px] lg:absolute lg:top-0 lg:right-48 lg:z-10 text-center">
                <p className="mt-5 text-xs leading-5 text-zinc-600">Logged in as {state.email}</p>
                {
                    pathname !== "/dashboard" ?
                    <a href="/dashboard" className="mt-10 lg:mt-1 inline-block w-full lg:w-5/12 lg:mr-2 rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                        Dashboard
                    </a>
                    : ''
                }
                <button onClick={handleLogout} className="mt-2 lg:mt-1 inline-block w-full lg:w-5/12 rounded-md bg-rose-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    Log Out
                </button>
            </div>;
        } else {
            return <div className="mb-12 lg:absolute lg:top-0 lg:right-48 lg:z-10">
                <a href="/auth" className="mt-11 block w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Log In</a>
            </div>
        }
    } else {
        return <div className="mb-12 lg:absolute lg:top-0 lg:right-48 lg:z-10">
        <p className="mt-11 block w-full px-3 py-2 text-center text-sm">Loading...</p>
    </div>
    }
 }