"use client";

import React, { useEffect } from "react";
import Image from "next/image";

type ModalProps = {
  show: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal(props: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    if (props.show) {
      window.addEventListener("keydown", handleEscape);
    }

    // Cleanup the event listener
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [props]);

  if (!props.show) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-10">
      <div className="bg-white bg-opacity-100 p-5 rounded shadow-lg w-1/3 sm:w-full md:w-2/3 lg:w-1/2 xl:w-1/3 max-w-2xl px-6 py-4">
        <button
          type="button"
          onClick={props.onClose}
          className="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
        >
          <span className="sr-only">Close menu</span>
          <Image
            className={`inline-block`}
            src="/close.svg"
            alt="Close"
            width={20}
            height={20}
            priority
          />
        </button>
        {props.children}
      </div>
    </div>
  );
}
