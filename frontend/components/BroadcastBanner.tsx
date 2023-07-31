'use client'
import Link from 'next/link';
import Image from 'next/image';
import { Dispatch, SetStateAction, useEffect } from 'react';

interface BannerProps {
    txHash: string,
    setTxHash: Dispatch<SetStateAction<string>>
}

export function BroadcastBanner(props: BannerProps) {
    const onClose = () => {
        props.setTxHash("")
    }

    if (props.txHash === "") {
        return null
    } else {
        return (
        <div className="fixed inset-x-0 mx-auto shadow-lg bottom-8 w-3/4 max-w-4xl px-8 py-6 rounded-sm bg-zinc-900 text-white" role="alert">
            <span onClick={onClose} className="absolute block top-2 right-4 font-bold cursor-pointer">✕</span>
            <span className="block font-medium text-lg">Successfully broadcast!</span><br />
            <Link target="_blank" href={"https://sepolia.etherscan.io/tx/" + props.txHash } className="block -mt-4 text-zinc-400 hover:text-white">
                View on Etherscan
                <Image
                  className={`inline-block invert`}
                  src="/arrow.svg"
                  alt="->"
                  width={20}
                  height={20}
                  priority
                />
            </Link>
        </div>
        )
    }
}