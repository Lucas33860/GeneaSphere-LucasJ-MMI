export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-7xl font-bold text-gray-200">404</p>
        <h1 className="text-2xl font-bold text-gray-900">Page introuvable</h1>
        <p className="text-gray-500">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <a
          href="/dashboard"
          className="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Retour au tableau de bord
        </a>
      </div>
    </main>
  );
}
