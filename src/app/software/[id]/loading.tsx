export default function SoftwareLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="h-4 w-48 bg-gray-800 rounded mb-4 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="h-80 bg-gray-800 rounded-2xl mb-6 animate-pulse" />
          <div className="h-6 w-64 bg-gray-800 rounded mb-4 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-gray-800 rounded-2xl animate-pulse" />
          <div className="h-32 bg-gray-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
