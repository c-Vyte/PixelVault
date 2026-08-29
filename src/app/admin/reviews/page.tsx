"use client";

import { useEffect, useState } from "react";
import {
  deleteWorkflowRecord,
  getWorkflowRecords,
  subscribeToWorkflowChanges,
  updateWorkflowRecord,
  type ContactMessage,
  type SoftwareRequest,
  type SoftwareReview,
} from "@/lib/workflowStore";

type InboxTab = "comments" | "requests" | "messages";
type ReviewFilter = "all" | "pending" | "approved" | "rejected";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function AdminReviews() {
  const [tab, setTab] = useState<InboxTab>("comments");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [reviews, setReviews] = useState<SoftwareReview[]>(() => getWorkflowRecords<SoftwareReview>("softwareReviews"));
  const [requests, setRequests] = useState<SoftwareRequest[]>(() => getWorkflowRecords<SoftwareRequest>("softwareRequests"));
  const [messages, setMessages] = useState<ContactMessage[]>(() => getWorkflowRecords<ContactMessage>("contactMessages"));

  const reload = () => {
    setReviews(getWorkflowRecords<SoftwareReview>("softwareReviews"));
    setRequests(getWorkflowRecords<SoftwareRequest>("softwareRequests"));
    setMessages(getWorkflowRecords<ContactMessage>("contactMessages"));
  };

  useEffect(() => subscribeToWorkflowChanges(reload), []);

  const updateReview = (id: string, status: Exclude<ReviewFilter, "all">) => {
    updateWorkflowRecord<SoftwareReview>("softwareReviews", id, { status });
    reload();
  };

  const updateRequest = (id: string, status: "pending" | "approved" | "rejected") => {
    updateWorkflowRecord<SoftwareRequest>("softwareRequests", id, { status });
    reload();
  };

  const updateMessage = (id: string, status: "unread" | "read" | "resolved") => {
    updateWorkflowRecord<ContactMessage>("contactMessages", id, { status });
    reload();
  };

  const remove = (key: "softwareReviews" | "softwareRequests" | "contactMessages", id: string) => {
    if (window.confirm("Delete this record?")) {
      deleteWorkflowRecord(key, id);
      reload();
    }
  };

  const filteredReviews = reviews.filter((review) => filter === "all" || review.status === filter);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
       <div>
         <h1 className="text-3xl font-bold text-white">Inbox</h1>
         <p className="mt-1 text-sm text-gray-400">Moderate comments and respond to community submissions.</p>
       </div>
         <div className="flex gap-2">
           {(["comments", "requests", "messages"] as InboxTab[]).map((item) => (
             <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-3 py-2 text-sm capitalize transition-colors ${tab === item ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
               {item} ({item === "comments" ? reviews.length : item === "requests" ? requests.length : messages.length})
             </button>
           ))}
         </div>
      </div>

       {tab === "comments" && (
         <>
           <div className="mb-6 flex gap-2">
             {(["all", "pending", "approved", "rejected"] as ReviewFilter[]).map((item) => (
               <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1 text-sm capitalize transition-colors ${filter === item ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                 {item}
               </button>
             ))}
           </div>
           {filteredReviews.length === 0 ? <EmptyState label="No comments in this view." /> : (
             <div className="space-y-4">
               {filteredReviews.map((review) => (
                 <div key={review.id} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                   <div className="mb-3 flex items-start justify-between gap-4">
                     <div>
                       <div className="flex flex-wrap items-center gap-2">
                         <span className="font-medium text-white">{review.user}</span>
                         <StatusBadge status={review.status} />
                       </div>
                       <p className="text-sm text-gray-500">on <span className="text-gray-300">{review.softwareTitle}</span> · {formatDate(review.createdAt)}</p>
                     </div>
                   </div>
                   <p className="mb-4 text-gray-300">{review.comment}</p>
                   <div className="flex flex-wrap gap-3 text-sm">
                     {review.status !== "approved" && <button onClick={() => updateReview(review.id, "approved")} className="text-green-400 hover:text-green-300">Approve</button>}
                     {review.status !== "rejected" && <button onClick={() => updateReview(review.id, "rejected")} className="text-yellow-400 hover:text-yellow-300">Reject</button>}
                     <button onClick={() => remove("softwareReviews", review.id)} className="text-red-400 hover:text-red-300">Delete</button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </>
       )}

      {tab === "requests" && (requests.length === 0 ? <EmptyState label="No software requests yet." /> : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-semibold text-white">{request.softwareName}</h2><p className="text-sm text-gray-400">{request.category} · {request.platform} · {formatDate(request.createdAt)}</p></div>
                <StatusBadge status={request.status} />
              </div>
              {request.description && <p className="mt-4 text-gray-300">{request.description}</p>}
              <p className="mt-3 text-sm text-gray-500">{request.email || "No email provided"}{request.downloadUrl && ` · ${request.downloadUrl}`}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {request.status !== "approved" && <button onClick={() => updateRequest(request.id, "approved")} className="text-green-400 hover:text-green-300">Mark approved</button>}
                {request.status !== "rejected" && <button onClick={() => updateRequest(request.id, "rejected")} className="text-yellow-400 hover:text-yellow-300">Reject</button>}
                <button onClick={() => remove("softwareRequests", request.id)} className="text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === "messages" && (messages.length === 0 ? <EmptyState label="No contact messages yet." /> : (
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{message.subject}</h2><p className="text-sm text-gray-400">{message.name} · {message.email} · {formatDate(message.createdAt)}</p></div><StatusBadge status={message.status} /></div>
              <p className="mt-4 whitespace-pre-wrap text-gray-300">{message.message}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">{message.status === "unread" && <button onClick={() => updateMessage(message.id, "read")} className="text-blue-300 hover:text-blue-200">Mark read</button>}{message.status !== "resolved" && <button onClick={() => updateMessage(message.id, "resolved")} className="text-green-400 hover:text-green-300">Resolve</button>}<button onClick={() => remove("contactMessages", message.id)} className="text-red-400 hover:text-red-300">Delete</button></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "approved" || status === "resolved" ? "text-green-400 bg-green-600/20" : status === "rejected" ? "text-red-400 bg-red-600/20" : status === "read" ? "text-blue-300 bg-blue-600/20" : "text-yellow-400 bg-yellow-600/20";
  return <span className={`rounded px-2 py-0.5 text-xs capitalize ${color}`}>{status}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-12 text-center text-gray-400">{label}</div>;
}
