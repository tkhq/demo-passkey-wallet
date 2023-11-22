"use client";

import React from "react";

type ModalProps = {
    show: boolean;
    onClose: () => void;
    children: React.ReactNode;
};

export function Modal(props: ModalProps) {
if (!props.show) {
    return null;
}

return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-10">
        <div className="bg-white bg-opacity-100 p-5 rounded shadow-lg w-1/3 sm:w-full md:w-2/3 lg:w-1/2 xl:w-1/3 max-w-2xl px-6 py-4">
            <button onClick={props.onClose}>Close</button>
            {props.children}
        </div>
    </div>
    );
};