export default function CategoryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="h-4 w-32 bg-gray-800 rounded mb-4 animate-pulse" />
        <div className="h-8 w-64 bg-gray-800 rounded mb-2 animate-pulse" />
        <div className="h-4 w-96 bg-gray-800 rounded animate-pulse" />
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-gray-800 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-5 w-48 bg-gray-800 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-800 rounded mb-3" />
                <div className="h-3 w-full bg-gray-800 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
