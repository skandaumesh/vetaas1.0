"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAdminAuth } from "@/components/admin/AdminGate";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  AlertCircle,
  X,
  PlusCircle,
  Calendar,
  MapPin,
  Link2,
  Image as ImageIcon,
  Trash2,
  Edit2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function AdminEventsPage() {
  const { user } = useAdminAuth();

  // Events & logic states
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    endDate: "",
    startTime: "",
    endTime: "",
    location: "",
    highlightsUrl: "",
    registrationUrl: "",
    manualImageUrl: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Custom alert/toast states
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Custom confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Custom highlights editing state
  const [editingHighlightsId, setEditingHighlightsId] = useState<string | null>(null);

  // Event form modal
  const [formOpen, setFormOpen] = useState(false);

  // One-off: move legacy base64 posters out of Firestore into Cloud Storage.
  // The button disappears once no event still holds an embedded image.
  // Fetch events once the admin is signed in
  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const fetchEvents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by date descending
      eventsData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching events: ", error);
      showToast("Failed to fetch events list.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.location) {
      showToast("Please fill in required fields.", "error");
      return;
    }

    setUploading(true);

    try {
      let imageUrl = "";

      if (imageFile) {
        // Resize/compress in the browser, then store the file in Cloud Storage
        // and keep only its URL in Firestore. Previously the image was embedded
        // as base64 in the document, which meant every visitor to /events
        // downloaded every poster as document data instead of cached CDN files.
        const blob = await new Promise<Blob>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          reader.onload = (event) => {
            const img = new window.Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const MAX = 1200;
              let { width, height } = img;
              if (width > height) {
                if (width > MAX) {
                  height *= MAX / width;
                  width = MAX;
                }
              } else if (height > MAX) {
                width *= MAX / height;
                height = MAX;
              }

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return reject(new Error("Canvas unavailable"));
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
                "image/jpeg",
                0.82
              );
            };
            img.onerror = (err) => reject(err);
          };
          reader.onerror = (err) => reject(err);
        });

        const fileRef = storageRef(
          storage,
          `eventImages/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        );
        await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
        imageUrl = await getDownloadURL(fileRef);
      } else if (formData.manualImageUrl) {
        imageUrl = formData.manualImageUrl;
      }

      const getComputedStatus = (startDate: string, endDateStr?: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = endDateStr || startDate;
        if (!checkDate) return "upcoming";
        try {
          const eventDate = new Date(checkDate);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate < today ? "completed" : "upcoming";
        } catch {
          return "upcoming";
        }
      };

      const computedStatus = getComputedStatus(formData.date, formData.endDate);

      const formatTime = (timeStr: string) => {
        if (!timeStr) return "";
        const [hourString, minute] = timeStr.split(":");
        const hour = parseInt(hourString, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minute} ${ampm}`;
      };

      const computedTimeSlot = (formData.startTime && formData.endTime) 
        ? `${formatTime(formData.startTime)} - ${formatTime(formData.endTime)}`
        : "";

      const eventData: any = {
        title: formData.title,
        date: formData.date,
        endDate: formData.endDate || "",
        timeSlot: computedTimeSlot,
        location: formData.location,
        highlightsUrl: formData.highlightsUrl,
        registrationUrl: formData.registrationUrl,
        status: computedStatus,
      };

      if (imageUrl) {
        eventData.image = imageUrl;
      }

      if (editingEventId) {
        // Update existing event
        await updateDoc(doc(db, "events", editingEventId), eventData);
        showToast("Event updated successfully!", "success");
      } else {
        // Create new event
        eventData.createdAt = new Date().toISOString();
        if (!imageUrl) eventData.image = ""; // Default empty string for new events without image
        await addDoc(collection(db, "events"), eventData);
        showToast("Event added successfully!", "success");
      }
      
      // Reset form
      setFormData({
        title: "",
        date: "",
        endDate: "",
        startTime: "",
        endTime: "",
        location: "",
        highlightsUrl: "",
        registrationUrl: "",
        manualImageUrl: ""
      });
      setEditingEventId(null);
      setImageFile(null);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
      // reset file input visually
      const fileInput = document.getElementById('image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchEvents();
      setFormOpen(false);
    } catch (error: any) {
      console.error("Error adding event: ", error);
      showToast(`Failed to add event: ${error.message || "Unknown error"}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleEditClick = (event: any) => {
    setEditingEventId(event.id);
    
    // Attempt to parse back start and end time from "10:00 AM - 1:00 PM"
    let parsedStart = "";
    let parsedEnd = "";
    if (event.timeSlot) {
      const parts = event.timeSlot.split(" - ");
      if (parts.length === 2) {
        const parseTo24 = (timeStr: string) => {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return "";
          let h = parseInt(match[1], 10);
          const m = match[2];
          const isPM = match[3].toUpperCase() === "PM";
          if (isPM && h < 12) h += 12;
          if (!isPM && h === 12) h = 0;
          return `${h.toString().padStart(2, "0")}:${m}`;
        };
        parsedStart = parseTo24(parts[0]);
        parsedEnd = parseTo24(parts[1]);
      }
    }

    setFormData({
      title: event.title || "",
      date: event.date || "",
      endDate: event.endDate || "",
      startTime: parsedStart,
      endTime: parsedEnd,
      location: event.location || "",
      highlightsUrl: event.highlightsUrl || "",
      registrationUrl: event.registrationUrl || "",
      manualImageUrl: event.image || ""
    });
    if (event.image) {
      setImagePreview(event.image);
    } else {
      setImagePreview(null);
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingEventId(null);
    setFormData({
      title: "", date: "", endDate: "", startTime: "", endTime: "",
      location: "", highlightsUrl: "", registrationUrl: "", manualImageUrl: ""
    });
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const openNewForm = () => {
    closeForm();
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    try {
      await deleteDoc(doc(db, "events", deleteConfirmId));
      fetchEvents();
      showToast("Event deleted successfully!", "success");
    } catch (error) {
      console.error("Error deleting event: ", error);
      showToast("Failed to delete event.", "error");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Automated status update handles completion status based on current date
  const isEventPast = (event: any) => {
    if (!event.date) return true;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = event.endDate || event.date;
      const eventDate = new Date(checkDate);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate < today;
    } catch {
      return false;
    }
  };

  const handleUpdateHighlights = async (id: string, highlightsUrl: string) => {
    try {
      await updateDoc(doc(db, "events", id), { highlightsUrl });
      fetchEvents();
      showToast("Highlights Reel URL updated successfully!", "success");
    } catch (error) {
      console.error("Error updating highlights: ", error);
      showToast("Failed to update highlights URL.", "error");
    }
  };

  const renderCard = (event: any) => {
    const computedStatus = isEventPast(event) ? "completed" : "upcoming";
    return (
      <div
        key={event.id}
        className="glass-card rounded-2xl p-5 hover:border-gray-300 transition-all duration-300 relative overflow-hidden flex flex-col gap-4 group"
      >
        <div className="flex gap-4 items-start">
          {event.image ? (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-100">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-50 border border-slate-100 flex items-center justify-center text-gray-400 shrink-0">
              <Calendar size={20} className="text-gray-300" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h3 className="font-bold text-gray-900 text-base truncate flex-1 min-w-[120px]">
                {event.title}
              </h3>
              <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full leading-none shrink-0 ${
                computedStatus === 'completed'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-green-100 text-green-700'
              }`}>
                {computedStatus}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar size={11} className="text-gray-400 shrink-0" />
                <span>{event.date}{event.endDate ? ` - ${event.endDate}` : ""}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
              {event.registrationUrl && (
                <span className="flex items-center gap-1.5 text-blue-500">
                  <Link2 size={11} className="text-blue-400 shrink-0" />
                  <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                    {event.registrationUrl}
                  </a>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Highlights / Reel Management block */}
        {computedStatus === "completed" && (
          <div className="mt-1 border-t border-gray-100 pt-3">
            {event.highlightsUrl && editingHighlightsId !== event.id ? (
              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">Highlights Reel / Link</span>
                  <a
                    href={event.highlightsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#7C3AED] hover:underline font-semibold truncate block"
                  >
                    {event.highlightsUrl}
                  </a>
                </div>
                <button
                  onClick={() => setEditingHighlightsId(event.id)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-white/60 border border-white/70 hover:bg-white/80 text-gray-600 rounded-lg transition cursor-pointer shrink-0"
                >
                  <Edit2 size={10} /> Edit
                </button>
              </div>
            ) : (
              <div className="bg-[#faf9f7] border border-slate-200/60 rounded-2xl p-3 flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block">Reel / Highlights URL</span>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="Instagram Reel or YouTube Link"
                    defaultValue={event.highlightsUrl || ""}
                    id={`highlights-input-${event.id}`}
                    className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] outline-none bg-white"
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={async () => {
                        const val = (document.getElementById(`highlights-input-${event.id}`) as HTMLInputElement)?.value || "";
                        await handleUpdateHighlights(event.id, val);
                        setEditingHighlightsId(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-2 bg-[#00CDBA] hover:bg-[#00b0a0] text-white rounded-xl transition cursor-pointer"
                    >
                      Save
                    </button>
                    {event.highlightsUrl && (
                      <button
                        onClick={() => setEditingHighlightsId(null)}
                        className="text-[10px] font-black uppercase tracking-widest px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex justify-end gap-2 border-t border-slate-100/80 pt-3 pr-2 pl-2">
          <div className="flex items-center gap-2 mt-4 ml-auto">
            <button
              onClick={() => handleEditClick(event)}
              className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-500 rounded-xl transition duration-200 shadow-sm flex items-center justify-center cursor-pointer"
              title="Edit Event"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDeleteClick(event.id)}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition duration-200 shadow-sm flex items-center justify-center cursor-pointer"
              title="Delete Event"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const upcomingEvents = events
    .filter((e) => !isEventPast(e))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completedEvents = events.filter((e) => isEventPast(e));

  // Authenticated Admin Panel
  return (
    <div className="min-h-screen py-8 md:py-10 px-4 md:px-10 relative">

      {/* Toast Notification Layer */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="pointer-events-auto"
            >
              <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-lg border backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                  : toast.type === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-600"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-600"
              }`}>
                {toast.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />}
                {toast.type === "error" && <XCircle className="w-5 h-5 shrink-0 text-rose-500" />}
                {toast.type === "info" && <AlertCircle className="w-5 h-5 shrink-0 text-blue-500" />}
                
                <p className="text-sm font-semibold flex-1 leading-snug">{toast.message}</p>
                
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-gray-400 hover:text-gray-600 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-white rounded-3xl shadow-xl border border-slate-100 p-6 w-full max-w-md overflow-hidden z-10"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4 relative">
                  <span className="absolute inset-0 rounded-full bg-rose-400/20 animate-ping opacity-75" />
                  <AlertTriangle className="w-7 h-7 relative z-10" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2 font-headline">Delete Event?</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed font-body">
                  Are you sure you want to delete this event? This action is permanent and cannot be undone.
                </p>
                
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition duration-200 cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 py-3 px-4 bg-[#FF5C7A] hover:bg-[#ff5c7a] text-white font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition duration-200 cursor-pointer text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-[2.15rem] font-semibold tracking-[-0.02em] text-slate-900">
              Events <span className="text-slate-300">dashboard</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Create and manage everything shown on the public events page.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNewForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add event
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-8">
          {[
            { label: "Total events", value: String(events.length), sub: "all time" },
            {
              label: "Upcoming",
              value: String(upcomingEvents.length),
              sub: upcomingEvents.length > 0 ? "scheduled ahead" : "nothing scheduled",
            },
            { label: "Completed", value: String(completedEvents.length), sub: "already held" },
          ].map((card) => (
            <div key={card.label} className="bg-white px-5 py-5">
              <p className="text-[13px] font-medium text-slate-400 mb-3">{card.label}</p>
              <p className="text-[2.5rem] font-semibold tabular-nums tracking-[-0.03em] leading-none mb-2 text-slate-900">
                {card.value}
              </p>
              <p className="text-xs text-slate-300">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Event Form Modal */}
        <AnimatePresence>
          {formOpen && (
          <div className="fixed inset-0 z-[9980] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-6 sm:p-8 z-10"
            >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold text-[#111827] flex items-center gap-2">
                {editingEventId ? <Edit2 className="w-5 h-5 text-[#7C3AED]" /> : <PlusCircle className="w-5 h-5 text-[#7C3AED]" />}
                {editingEventId ? "Edit Event" : "Add New Event"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5 font-body">
              <div>
                <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                  Event Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  placeholder="e.g. Creative Play Workshop"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider -mt-2">
                Note: Status calculates automatically (marks completed when event dates pass).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startTime" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                    Start Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                    End Time (Optional)
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                  Location *
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  placeholder="e.g. Virtual, Bengaluru Central"
                />
              </div>

              <div>
                <label htmlFor="registrationUrl" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 font-headline">
                  Registration Link or Luma URL (Optional)
                </label>
                <input
                  type="text"
                  id="registrationUrl"
                  name="registrationUrl"
                  value={formData.registrationUrl}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] outline-none text-sm transition-all duration-200 bg-white"
                  placeholder="e.g. https://forms.gle/... or Luma link"
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 font-headline">
                  Event Thumbnail Image (Optional)
                </label>
                
                <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                  <div className="w-full">
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#00CDBA]/10 file:text-[#00CDBA] hover:file:bg-[#00CDBA]/20 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-300 mt-2">Images compress dynamically and store instantly.</p>
                  </div>
                </div>
                
                <AnimatePresence>
                  {imagePreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: "1rem" }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video group">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              if (imagePreview) {
                                URL.revokeObjectURL(imagePreview);
                                setImagePreview(null);
                              }
                              const fileInput = document.getElementById('image') as HTMLInputElement;
                              if (fileInput) fileInput.value = '';
                            }}
                            className="p-2.5 bg-[#FF5C7A] hover:bg-[#ff5c7a] text-white rounded-full transition shadow-lg flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 duration-200 text-sm mt-3"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Event...
                  </>
                ) : (
                  editingEventId ? "Update Event" : "Save Event"
                )}
              </button>
            </form>
            </motion.div>
          </div>
          )}
        </AnimatePresence>

        {/* List Section */}
        <div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
                <span className="font-semibold">Loading events list...</span>
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center bg-white/50 rounded-2xl border border-dashed border-gray-300">
                No events yet. Click &quot;Add Event&quot; to create your first one.
              </p>
            ) : (
              <div className="space-y-10">
                {/* Upcoming events — first section */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Upcoming
                    </h3>
                    <span className="text-xs text-slate-400 tabular-nums">{upcomingEvents.length}</span>
                  </div>
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-slate-400 py-8 text-center bg-white/50 rounded-2xl border border-dashed border-gray-200 text-sm">
                      No upcoming events. Click &quot;Add Event&quot; to schedule one.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 font-body items-start">
                      {upcomingEvents.map(renderCard)}
                    </div>
                  )}
                </section>

                {/* Completed events — second section */}
                {completedEvents.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Completed
                      </h3>
                      <span className="text-xs text-slate-400 tabular-nums">{completedEvents.length}</span>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 font-body items-start">
                      {completedEvents.map(renderCard)}
                    </div>
                  </section>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

