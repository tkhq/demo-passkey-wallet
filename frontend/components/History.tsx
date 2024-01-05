"use client";
import { getWalletHistoryUrl } from "@/utils/urls";
import axios from "axios";
import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";

type history = {
  data: Array<transfer>;
};

type transfer = {
  type: string;
  block: number;
  source: string;
  destination: string;
  amount: string;
  hash: string;
};

async function historyFetcher(url: string): Promise<history> {
  let response = await axios.get(url, { withCredentials: true });
  if (response.status === 200) {
    return {
      data: response.data,
    };
  } else {
    // Other status codes indicate an error of some sort
    return {
      data: [],
    };
  }
}

function abbreviateAddress(address: string): string {
  return (
    address.substring(0, 6) +
    "..." +
    address.substring(address.length - 4, address.length)
  );
}

export function History() {
  const { data: history } = useSWR(getWalletHistoryUrl(), historyFetcher, {
    refreshInterval: 10000,
  });

  return (
    <>
      {history && history.data && history.data.length > 0 ? (
        <>
          <h2 className="text-3xl font-medium favorit m-8">History</h2>

          <div className="table table-auto w-full border-collapse border border-zinc-300">
            <div className="table-header-group text-zinc-500">
              <div className="table-row bg-subtle-accent text-sm">
                <div className="table-cell p-3">Transaction type</div>
                <div className="table-cell p-3">Amount</div>
                <div className="table-cell p-3">From</div>
                <div className="table-cell p-3">To</div>
              </div>
            </div>
            <div className="table-row-group">
              {history?.data.map((transfer) => (
                <div
                  className="table-row h-8 border border-t-1 border-zinc-300"
                  key={transfer.hash}
                >
                  <div className="table-cell p-3">
                    {transfer.type === "withdrawal" ? (
                      <span className="inline-block text-zinc-500 bg-send-pill rounded-xl p-2">
                        Send
                      </span>
                    ) : (
                      <span className="inline-block text-zinc-500 bg-receive-pill rounded-xl p-2">
                        Receive
                      </span>
                    )}
                    <Link
                      target="_blank"
                      href={"https://sepolia.etherscan.io/tx/" + transfer.hash}
                      title="View on Etherscan"
                      className="inline-block ml-2"
                    >
                      <Image
                        src="/external_link.svg"
                        alt="->"
                        width={16}
                        height={16}
                        priority
                      />
                    </Link>
                  </div>
                  <div className="table-cell p-3 font-mono">
                    {transfer.amount} ETH
                  </div>
                  <div className="table-cell p-3 font-mono">
                    {abbreviateAddress(transfer.source)}
                  </div>
                  <div className="table-cell p-3 font-mono">
                    {abbreviateAddress(transfer.destination)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
