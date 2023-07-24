'use client'
import Link from 'next/link';
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
        <div className="relative p-4 m-8 text-sm text-green-800 rounded-md bg-green-200" role="alert">
            <span onClick={onClose} className="absolute block top-2 right-4 font-bold cursor-pointer">✕</span>
            <span className="font-medium">Successfully broadcast! Transaction hash: <pre>{props.txHash}</pre></span><br />
            <Link target="_blank" href={"https://sepolia.etherscan.io/tx/" + props.txHash } className="font-bold underline">View on Etherscan</Link>
        </div>
        )
    }
}