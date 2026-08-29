"use client";

import { useEffect, useState } from "react";
import {
  getDeadLinkReports,
  resolveDeadLinkReport,
  deleteWorkflowRecord,
  subscribeToWorkflowChanges,
  type DeadLinkReport,
} from "@/lib/workflowStore";

type Filter = "all" | "pending" | "resolved";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminReports() {
  const [filter, setFilter] = useState<Filter>("all");
  const [reports, setReports] = useState<DeadLinkReport[]>(() => getDeadLinkReports());

  const reload = () => setReports(getDeadLinkReports());

  useEffect(() => subscribeToWorkflowChanges(reload), []);

  const resolve = (id: string) => {
    resolveDeadLinkReport(id);
    reload();
  };

  const remove = (id: string) => {
    if (window.confirm("Delete this report?")) {
      deleteWorkflowRecord("deadLinkReports", id);
      reload();
    }
  };

  const filtered = reports.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Broken Link Reports</h1>
          <p className="mt-1 text-sm text-gray-400">
            {pendingCount > 0 ? `${pendingCount} pending report${pendingCount > 1 ? "s" : ""} — links users flagged as broken.` : "No pending reports. All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "resolved"] as Filter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-3 py-2 text-sm capitalize transition-colors ${filter === item ? "bg-blue-600 text-white" : "bg-[#111827] text-gray-400 hover:text-white border border-blue-900/30"}`}
            >
              {item} ({item === "all" ? reports.length : reports.filter((r) => r.status === item).length})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-900/30 bg-[#111827] p-12 text-center text-gray-400">No reports in this view.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => (
            <div key={report.id} className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{report.softwareTitle}</span>
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${report.status === "resolved" ? "text-green-400 bg-green-600/20" : "text-yellow-400 bg-yellow-600/20"}`}>{report.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Reported by {report.reportedBy} · {formatDate(report.createdAt)}</p>
                </div>
              </div>
              <a href={report.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-blue-400 hover:text-blue-300 mb-3">
                {report.url}
              </a>
              {report.message && <p className="mb-4 rounded-lg bg-blue-900/20 p-3 text-sm text-gray-300">{report.message}</p>}
              <div className="flex flex-wrap gap-3 text-sm">
                {report.status !== "resolved" && (
                  <button onClick={() => resolve(report.id)} className="text-green-400 hover:text-green-300">Mark Resolved</button>
                )}
                <button onClick={() => remove(report.id)} className="text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
