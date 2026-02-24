"use client";

import { useState } from "react";
import { useAuthStore } from "../store";

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginMock } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeAuthModal}
      />

      {/* modal */}
      <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg">
        <div className="mb-4">
          <div className="text-lg font-semibold">Prijava</div>
          <div className="text-sm text-muted-foreground">
            Uloguj se da nastaviš.
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
            disabled={!email || !password}
            onClick={() => loginMock(email)}
          >
            Login
          </button>

          <button
            className="h-10 w-full rounded-md border text-sm hover:bg-muted"
            onClick={closeAuthModal}
          >
            Otkaži
          </button>
        </div>
      </div>
    </div>
  );
}