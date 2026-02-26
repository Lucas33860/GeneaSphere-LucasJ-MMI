"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-7xl font-bold text-gray-200">500</p>
        <h1 className="text-2xl font-bold text-gray-900">Une erreur est survenue</h1>
        <p className="text-gray-500">
          {error.message || "Quelque chose s'est mal passé côté serveur."}
        </p>
        <div className="flex gap-3 justify-center mt-2">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Tableau de bord
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-300 pt-2">Réf. : {error.digest}</p>
        )}
      </div>
    </main>
  );
}
