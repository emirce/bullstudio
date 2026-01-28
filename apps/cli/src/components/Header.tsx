import { useState } from "react";

export default function Header({ title }: { title?: string }) {
  return (
    <>
      <header className="p-4 h-16 flex items-center bg-gray-800 text-white shadow-lg">
        <h1 className="ml-4 text-lg font-semibold">{title}</h1>
      </header>
    </>
  );
}
