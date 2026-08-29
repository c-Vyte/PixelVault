"use client";

import { useState } from "react";
import { dependencies } from "@/lib/dependencies";

interface NeedHelpPanelProps {
  onClose: () => void;
  softwareTitle: string;
}

function getDepInfo(depName: string): { url: string; label: string } | null {
  const depMap: Record<string, { url: string; label: string }> = {
    "DirectX": {
      url: "https://www.microsoft.com/en-us/download/details.aspx?id=13523",
      label: "Download DirectX End-Runtime",
    },
    "Visual": {
      url: "https://aka.ms/vs/17 of 2015",
      label: "Download Visual C++ Redistributable",
    },
    "DirectX End-user": {
      url: "https://support.microsoft.com/en-us/topic/directx-end-user-runtime-package-directx-12-418cbb0b-0bdf-0bdf-0bdf-0bdf-0bdf",
      label: "DirectX Repair Tool",
    },
    "7-Zip": {
      url: "https://www.7-zip.org/download.html",
      label: "Download 7-Zip",
    },
    "Android SDK": {
      url: "https://developer.android.com/studio",
      label: "Download Android SDK",
    },
    "Xcode": {
      url: "https://developer.apple.com/xcode/",
      label: "Download Xcode",
    },
  };

  const dep = depMap[depName];
  return dep ? dep : null;
}

export default function NeedHelpPanel({
  onClose,
  softwareTitle,
}: NeedHelpPanelProps) {
  const [selectedDep, setSelectedDep] = useState("");
  const [openUrl, setOpenUrl] = useState("");

  const handleViewDep = (depName: string) => {
    const info = getDepInfo(depName);
    if (info) {
      setOpenUrl(info.url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-zxl z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Need Help</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <p className="text-gray-300 mb-6 text-sm">
          Having trouble running {softwareTitle}? Below are the dependencies you may need,
          along with official links and tutorials.
        </p>

        <div className="space-y-4">
          {dependencies.map((dep) => (
            <div key={dep.name} className="bg-[#0a0f1a] border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-medium">
                  {dep.name.charAt(0)}
                </span>
                <div>
                  <p className="text-white font-medium">{dep.name}</p>
                  <p className="text-gray-400 text-sm">{dep.description}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={dep.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  Official Link
                </a>
                <a
                  href="#"
                  onClick={() => handleViewDep(dep.name)}
                  className="text-gray-400 hover:text-blue-300 text-sm ml-2 underline"
                >
                  Tutorial
                </a>
              </div>
            </div>
          ))}

          {selectedDep && (
            <div className="mt-6 p-4 bg-[#0a0f1a] rounded-lg">
              <h3 className="text-lg font-bold text-white mb-2">
                Selected Dependency
              </h3>
              <p className="text-gray-300">{selectedDep}</p>
              <a
                href="#"
                onClick={() => {
                  const info = getDepInfo(selectedDep);
                  if (info) setOpenUrl(info.url);
                }}
                className="text-blue-400 underline"
              >
                Open Official Link
              </a>
            </div>
          )}

          {/* WhatsApp Contact Section */}
          <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">
              Get Personal Guidance
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Contact our support team for personalized assistance with game installation and dependency issues.
            </p>
            <a
              href="https://wa.me/1234567890?text=I need help with {softwareTitle} dependencies"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-center text-sm font-medium transition-colors"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}