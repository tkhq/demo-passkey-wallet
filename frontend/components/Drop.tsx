"use client";
import axios from "axios";
import { dropUrl } from "@/utils/urls";
import { useSWRConfig } from "swr";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface DropProps {
  dropsLeft: number;
  setTxHash: Dispatch<SetStateAction<string>>;
}

export function Drop(props: DropProps) {
  const [dropping, setDropping] = useState(false);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    async function startDrop() {
      if (dropping === true) {
        const res = await axios.post(dropUrl(), {}, { withCredentials: true });
        if (res.status !== 200) {
          console.error("error while attempting to drop!", res);
          setDropping(false);
        } else {
          setTimeout(() => {
            props.setTxHash(res.data["hash"]);
            setDropping(false);
          }, 1500);
        }
      }
    }

    startDrop();
  }, [dropping, mutate, props]);

  if (props.dropsLeft == 0) {
    return <span>No more drops left! 😭</span>;
  }

  if (dropping === true) {
    return <span>Drop in progress...</span>;
  }

  return (
    <a
      className="text-indigo-600 cursor-pointer underline"
      onClick={() => {
        setDropping(true);
      }}
    >
      Click here to fund your wallet ({props.dropsLeft}{" "}
      {props.dropsLeft > 1 ? "drops" : "drop"} remaining)
    </a>
  );
}
