"use client";

import { useState, useRef, useEffect } from "react";
import { getSoftwareList, type Software } from "@/lib/data";

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: "banner" | "poster" | "other";
  size: string;
}

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSoftwareList().then((softwareList: Software[]) => {
      const items: MediaItem[] = [];
      softwareList.forEach((sw) => {
        if (sw.icon && !sw.icon.startsWith("https://placehold")) {
          items.push({
            id: `${sw.id}-banner`,
            name: `${sw.title} — Banner`,
            url: sw.icon,
            type: "banner",
            size: "616×352",
          });
        }
        if (sw.poster && !sw.poster.startsWith("https://placehold")) {
          items.push({
            id: `${sw.id}-poster`,
            name: `${sw.title} — Poster`,
            url: sw.poster,
            type: "poster",
            size: "600×900",
          });
        }
      });
      setMedia(items);
      setLoaded(true);
    });
  }, []);

  const [filter, setFilter] = useState<"all" | "banner" | "poster">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = media.filter((item) => {
    const matchesFilter = filter === "all" || item.type === filter;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const selectedItem = media.find((m) => m.id === selected);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newItem: MediaItem = {
          id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url: ev.target?.result as string,
          type: "other",
          size: `${(file.size / 1024).toFixed(0)} KB`,
        };
        setMedia((prev) => [newItem, ...prev]);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    if (confirm("Remove this image from the library?")) {
      setMedia(media.filter((m) => m.id !== id));
      if (selected === id) setSelected(null);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Media Library</h1>
          <p className="text-gray-400 text-sm mt-1">{media.length} images</p>
        </div>
        <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
          <span>+</span> Upload Image
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search images..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-700"
            />
            <svg className="absolute left-3 top-3 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-2">
            {(["all", "banner", "poster"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {f === "all" ? "All" : f === "banner" ? "Banners" : "Posters"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(item.id === selected ? null : item.id)}
                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  selected === item.id
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-transparent hover:border-gray-600"
                }`}
              >
                <div className={`bg-gray-800 ${item.type === "poster" ? "aspect-[2/3]" : "aspect-video"}`}>
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs truncate">{item.name}</p>
                  <p className="text-gray-400 text-xs">{item.size}</p>
                </div>
                <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs ${
                  item.type === "banner"
                    ? "bg-blue-600 text-white"
                    : item.type === "poster"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-600 text-white"
                }`}>
                  {item.type}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No images found.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedItem && (
          <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 p-4 flex-shrink-0">
            <div className="mb-4">
              <div className={`rounded-lg overflow-hidden bg-gray-900 ${selectedItem.type === "poster" ? "aspect-[2/3]" : "aspect-video"}`}>
                <img
                  src={selectedItem.url}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-xs mb-1">Name</p>
                <p className="text-white text-sm">{selectedItem.name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Type</p>
                <p className="text-white text-sm capitalize">{selectedItem.type}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Dimensions</p>
                <p className="text-white text-sm">{selectedItem.size}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">URL</p>
                <p className="text-white text-xs break-all bg-gray-900 rounded p-2 max-h-20 overflow-auto">
                  {selectedItem.url.startsWith("data:") ? "Uploaded file (base64)" : selectedItem.url}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                {!selectedItem.url.startsWith("data:") && (
                  <button
                    onClick={() => handleCopyUrl(selectedItem.url)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm transition-colors"
                  >
                    Copy URL
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedItem.id)}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 rounded-lg text-sm transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
