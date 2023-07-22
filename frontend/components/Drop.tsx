'use client'
import axios from 'axios';
import { dropUrl, getWalletUrl, logoutUrl, whoamiUrl } from '@/utils/urls';
import { useSWRConfig } from 'swr';
import { useEffect, useState } from 'react';

interface DropProps {
    dropsLeft: number
}

export function Drop(props: DropProps) {
    const [dropping, setDropping] = useState(false)
    const { mutate } = useSWRConfig()

    useEffect(() => {
        async function startDrop() {
            if (dropping === true) {
                const res = await axios.post(dropUrl(), {}, { withCredentials: true });
                if (res.status !== 200) {
                    console.error("error while attempting to drop!", res);
                    setDropping(false)
                } else {
                    // Success! Wait 4s then make sure we invalidate the wallet info
                    // (this will cause components to refresh balances)
                    setTimeout(() => {
                        mutate(getWalletUrl())
                        setDropping(false)
                    }, 4000)
                }
            }
        }
        
        startDrop();
    }, [dropping])

    if (props.dropsLeft == 0) {
        return <span>No more drops left! 😭</span>
    }

    if (dropping === true) {
        return <span>🙏 Dropping...(hold on for a few seconds) 🙏</span>
    }

    return <a className="text-indigo-600 cursor-pointer" onClick={() => { setDropping(true) }}>
        Fund my wallet ({props.dropsLeft} {props.dropsLeft > 1 ? "drops" : "drop"} remaining) {"💧".repeat(props.dropsLeft)}
        </a>
    }