'use client'
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './context/auth.context';
import axios from 'axios';
import { logoutUrl, whoamiUrl } from '@/utils/urls';
import { useSWRConfig } from 'swr';
import { AuthWidget } from './AuthWidget';

export function Nav() {
    return (
    <div className="grid grid-cols-2">
        <div className="col-start-1">
            <a
                className="text-4xl font-medium"
                href="/"
                rel="noopener noreferrer"
            >
                Demo Passkey Wallet
            </a>
        </div>

        <div className="col-start-2">
            <AuthWidget></AuthWidget>
        </div>
    </div>
    )
 }