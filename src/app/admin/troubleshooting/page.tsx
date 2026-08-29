"use client";

export default function TroubleshootingPage() {
  const filter = "all";

  const categories = [
    { value: "all", label: "All Issues" },
    { value: "installation", label: "Installation Issues" },
    { value: "dependencies", label: "Missing Dependencies" },
    { value: "performance", label: "Performance Issues" },
    { value: "errors", label: "Error Messages" },
  ];

  const issues = [
    {
      id: 1,
      title: "Game won't launch",
      category: "installation",
      symptoms: "Game crashes on startup or won't open",
      solutions: [
        "Verify game files through the launcher",
        "Run as administrator",
        "Update graphics drivers",
        "Install DirectX end-user runtime",
        "Check game compatibility with your OS",
      ],
    },
    {
      id: 2,
      title: "Missing DLL files",
      category: "dependencies",
      symptoms: "Missing DLL error messages",
      solutions: [
        "Install Microsoft Visual C++ Redistributable",
        "Install DirectX End-user Runtime",
        "Use DLL repair tools",
        "Reinstall the game",
        "Check for system updates",
      ],
    },
    {
      id: 3,
      title: "Performance issues",
      category: "performance",
      symptoms: "Game runs slowly, low FPS, lag",
      solutions: [
        "Lower graphics settings",
        "Update graphics drivers",
        "Close background applications",
        "Verify hardware meets minimum requirements",
        "Adjust virtual memory/page file settings",
      ],
    },
    {
      id: 4,
      title: "Error messages",
      category: "errors",
      symptoms: "Specific error codes or messages",
      solutions: [
        "Search error code online",
        "Verify game version compatibility",
        "Reinstall game",
        "Check for patches/updates",
        "Verify game files integrity",
      ],
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-6 mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Troubleshooting Guide
        </h1>
        <p className="text-gray-400">
          Common issues and solutions for games and software
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-400">Filter by:</span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {}}
              className="px-3 py-1 rounded-lg text-sm"
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="border border-blue-900/20 rounded-lg p-4 hover:bg-blue-900/10 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-medium">
                  {issue.id}
                </div>
                <div>
                  <h3 className="text-white font-medium">{issue.title}</h3>
                  <p className="text-gray-400 text-sm">{issue.category}</p>
                </div>
              </div>
              <p className="text-gray-300 text-xs line-clamp-2">
                {issue.symptoms}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}