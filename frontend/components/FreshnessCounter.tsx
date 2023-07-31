'use client'
import { useEffect, useState } from 'react';

interface FreshnessCounterProps {
    isValidating: boolean,
    updateFrequency: number,
}

export function FreshnessCounter(props: FreshnessCounterProps) {
    // We cheat slightly here, our refresh interval is n+1s instead of n. But otherwise "refreshing..." wouldn't be readable.
    const [secsAgo, setSecsAgo] = useState(props.updateFrequency + 1);

    useEffect(() => {
        if (props.isValidating) {
            setSecsAgo(props.updateFrequency)
        }
    }, [props.isValidating, setSecsAgo, props.updateFrequency])

    useEffect(() => {
        const interval = setInterval(() => setSecsAgo(Math.max(secsAgo - 1, 0)), 1000);
        return () => {
          clearInterval(interval);
        };
      }, [secsAgo, setSecsAgo]);
    
    if (secsAgo === 0) {
        return <span className="text-xs ml-2 text-green-700 font-semibold">refreshing...</span>
    } else {
        return (
        <span className="text-xs ml-2 text-zinc-600">
            (next refresh in {secsAgo}s)
        </span>
        )
    }
}