export interface DependencyInfo {
  name: string;
  description: string;
  officialUrl: string;
  category: "runtime" | "framework" | "tool" | "other";
}

export const dependencies: DependencyInfo[] = [
  // Runtime dependencies
  {
    name: "DirectX 11/12",
    description: "Required for most Windows games to run properly",
    officialUrl: "https://www.microsoft.com/en-us/download/details.aspx?id=13523",
    category: "runtime",
  },
  {
    name: "Visual C++ Redistributable",
    description: "C++ runtime libraries needed by many games",
    officialUrl: "https://aka.ms/vs/17 of 2015",
    category: "runtime",
  },
  {
    name: " .NET Framework",
    description: "Needed for some games and applications",
    officialUrl: "https://dotnet.microsoft.com/en-us/download/dotnet-framework",
    category: "runtime",
  },

  // Framework dependencies
  {
    name: "DirectX End-user Runtimes (diredctx)",
    description: "DirectX installation and repair tool",
    officialUrl: "https://support.microsoft.com/en-us/topic/directx-end-user-runtime-package-directx-12-418cbb0b-0bdf-0bdf-0bdf-0bdf-0bdf",
    category: "runtime",
  },

  // Tools
  {
    name: "7-Zip",
    description: "File archiver for extracting game files",
    officialUrl: "https://www.7-zip.org/download.html",
    category: "tool",
  },
  {
    name: "WinRAR",
    description: "Alternative file archiver for game installation",
    officialUrl: "https://www.rarlab.com/rar/winrar.exe",
    category: "tool",
  },

  // Common game dependencies
  {
    name: "Microsoft .NET Framework 4.8",
    description: "Required by many modern Windows games",
    officialUrl: "https://dotnet.microsoft.com/en-us/download/dotnet-framework/thank-you/net48-web-installer",
    category: "framework",
  },
];