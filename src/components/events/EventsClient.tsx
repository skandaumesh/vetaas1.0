"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Share2,
  Check,
  Clock,
} from "lucide-react";

import Image from "next/image";
import { parseLumaUrl, initLumaCheckout, formatEventDateRange } from "@/lib/luma";

/**
 * How tall a poster may be on a card. A square crop in a two-column grid is
 * around 550px tall on its own, which dwarfs everything beside it.
 */
const cardAspect = (event: { imageAspect?: number }) =>
  String(Math.max(1.4, Number(event.imageAspect) || 16 / 10));

export default function EventsClient() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.substring(1); // remove '#'
        setHighlightedId(id);
        
        // Scroll to element after state change
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);

        // Auto clear highlight after 8 seconds (longer duration so it attracts and is readable)
        const timer = setTimeout(() => {
          setHighlightedId(null);
        }, 8000);
        return () => clearTimeout(timer);
      }
    };

    // Run on mount
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "events"));
        const eventsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        eventsData.sort(
          (a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setEvents(eventsData);
      } catch (error) {
        console.warn("Error fetching events: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const isCompleted = (event: any) => {
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

  // A cancelled event comes off the website entirely.
  const liveEvents = events.filter((e) => !e.cancelled);
  const upcomingEvents = liveEvents.filter((e) => !isCompleted(e));
  const pastEvents = liveEvents.filter((e) => isCompleted(e));

  // Initialize Luma checkout widget and dynamic script binding
  useEffect(() => {
    if (!loading && events.length > 0) {
      initLumaCheckout();
    }
  }, [loading, events]);

  return (
    <div className="min-h-screen bg-[#faf9f7] pt-[calc(var(--header-height)+3rem)] pb-24 relative z-10 font-sans">

      {/* ── Page Header ── */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Eyebrow */}
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#00CDBA] mb-5">
            What's happening
          </p>

          {/* Title row */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b-2 border-[#111827]">
            <h1 className="font-headline text-6xl md:text-8xl text-[#111827] leading-none tracking-tight">
              Events
            </h1>
            <p className="text-base md:text-lg text-gray-500 font-medium max-w-sm md:text-right">
              Fun-filled gatherings where learning meets play and joy meets growth.
            </p>
          </div>
        </motion.div>
      </div>


      {/* ── Main Content ── */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-16 lg:gap-20">

        {/* Left: Events */}
        <div>

          {/* Upcoming */}
          <Section
            label="Coming Soon"
            loading={loading}
            empty={upcomingEvents.length === 0}
            emptyLabel="No upcoming events right now. Stay tuned!"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  isHighlighted={event.id === highlightedId}
                />
              ))}
            </div>
          </Section>

          {/* Mobile Calendar (visible only on mobile/tablet) */}
          <div className="block lg:hidden mt-16">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                Calendar
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <RealCalendar events={events} />
          </div>

          {/* Past — Card Grid */}
          <div className="mt-20">
            <div className="flex items-center gap-4 mb-10">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                Memories
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-gray-100 h-72" />
                ))}
              </div>
            ) : pastEvents.length === 0 ? (
              <p className="text-gray-400 font-medium py-8">No past events yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastEvents.map((event, i) => (
                  <MemoryCard
                    key={event.id}
                    event={event}
                    index={i}
                    isHighlighted={event.id === highlightedId}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right: Calendar */}
        <div className="hidden lg:block border-l-2 border-[#FF5C7A]/20 pl-8">
          <div className="sticky top-32">
            <RealCalendar events={events} />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({
  label,
  loading,
  empty,
  emptyLabel,
  children,
  className = "",
}: {
  label: string;
  loading: boolean;
  empty: boolean;
  emptyLabel: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* Section label */}
      <div className="flex items-center gap-4 mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
          {label}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {loading ? (
        <div className="space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex gap-6 py-6 border-b border-gray-100">
              <div className="w-16 shrink-0">
                <div className="h-14 bg-gray-100 rounded" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : empty ? (
        <p className="text-gray-400 font-medium py-8">{emptyLabel}</p>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

/* ── Share Button ── */
function ShareButton({ event, variant = "light" }: { event: any; variant?: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = `${window.location.origin}/events/${event.id}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const baseClass = variant === "dark"
    ? "inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors p-1"
    : "inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#00CDBA] transition-colors p-1";

  return (
    <button
      onClick={handleShare}
      className={baseClass}
      title="Copy registration link"
    >
      {copied ? (
        <>
          <Check size={13} className="text-[#00cdba]" />
          <span className="text-[10px] text-[#00cdba] uppercase tracking-wider font-bold">Copied</span>
        </>
      ) : (
        <>
          <Share2 size={13} />
          <span className="text-[10px] uppercase tracking-wider">Share</span>
        </>
      )}
    </button>
  );
}

/* ── Editorial Event Card ── */

function EventCard({
  event,
  index,
  isHighlighted = false,
  muted = false,
}: {
  event: any;
  index: number;
  isHighlighted?: boolean;
  muted?: boolean;
}) {
  let day = "01";
  let monthStr = "Jan";
  let yearStr = "";
  let durationDays = 1;
  let hasRange = false;
  
  try {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      const startDayNum = dateObj.getDate();
      day = String(startDayNum).padStart(2, "0");
      monthStr = dateObj.toLocaleString("default", { month: "short" }).toUpperCase();
      yearStr = String(dateObj.getFullYear());

      if (event.endDate) {
        const endDateObj = new Date(event.endDate);
        if (!isNaN(endDateObj.getTime()) && endDateObj.toDateString() !== dateObj.toDateString()) {
          const endDayNum = endDateObj.getDate();
          
          const diffTime = Math.abs(endDateObj.getTime() - dateObj.getTime());
          durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          day = `${startDayNum}-${endDayNum}`;
          hasRange = true;
        }
      }
    }
  } catch (e) {}

  const formattedFull = formatEventDateRange(event.date, event.endDate, true);

  const isCompleted = (() => {
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
  })();

  return (
    <motion.div
      id={event.id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full relative"
      animate={isHighlighted ? {
        scale: [1, 1.04, 1.02],
        y: -6,
      } : { scale: 1, y: 0 }}
    >
      {/* Floating Highlight Badge */}
      {isHighlighted && (
        <div className="absolute -top-3 -right-2 z-30 flex items-center gap-1.5 bg-[#ff5c7a] text-white text-[9px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-lg shadow-[#ff5c7a]/30 border-2 border-white animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          Selected Event
        </div>
      )}
      <div className={`group flex flex-col h-full p-5 rounded-3xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
        isHighlighted
          ? "ring-4 ring-[#ff5c7a] border-[#ff5c7a] bg-gradient-to-br from-white to-[#ff5c7a]/5 shadow-[0_15px_40px_rgba(255,127,104,0.3)]"
          : "border-[#00CDBA]/25 bg-gradient-to-br from-white to-[#00CDBA]/5 shadow-[0_4px_20px_rgba(54,186,152,0.03)] hover:border-[#00CDBA]/40"
      }`}>
        {/* Card Image */}
        {event.image && (
          <div
          style={{ aspectRatio: cardAspect(event), maxHeight: "15rem" }}
          className="relative w-full rounded-2xl overflow-hidden mb-5 border border-gray-100 shrink-0"
        >
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              sizes="(max-width: 640px) 100vw, 350px"
            />
          </div>
        )}

        {/* Card Body */}
        <div className="flex gap-4 flex-1">
          {/* Left: Date Badge */}
          <div className={`shrink-0 ${hasRange ? 'w-12 sm:w-14' : 'w-10'} text-center bg-gradient-to-br from-[#00CDBA] to-[#00cdba] rounded-xl py-2 flex flex-col justify-center h-fit select-none shadow-sm shadow-[#00CDBA]/10 group-hover:scale-105 transition-all duration-300`}>
            <span className={`font-headline font-bold text-white leading-none ${hasRange ? 'text-xs sm:text-sm' : 'text-lg sm:text-xl'}`}>{day}</span>
            <span className="text-[7px] font-black uppercase tracking-[0.05em] text-white/90 mt-1">{monthStr}</span>
            <span className="text-[6.5px] font-semibold text-white/75 mt-0.5">{yearStr}</span>
          </div>

          {/* Right: Event Details */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="mb-2 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-0.5 rounded-full ${
                isCompleted
                  ? "bg-gray-100 text-gray-400"
                  : "bg-[#00CDBA]/10 text-[#00cdba]"
              }`}>
                {isCompleted ? "Completed" : "Upcoming"}
              </span>
            </div>

            <h3 className="font-headline text-base sm:text-lg text-[#111827] font-bold leading-snug mb-2 line-clamp-2 group-hover:text-[#00CDBA] transition-colors duration-300">
              {event.title}
            </h3>

            <div className="mt-auto flex flex-col gap-1.5 text-[11px] font-medium text-gray-500">
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={11} className="text-gray-400 shrink-0" />
                  {event.mapUrl || /^https?:[/][/]/i.test(event.location) ? (
                    <a
                      href={event.mapUrl || event.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="truncate hover:underline"
                    >
                      {/^https?:[/][/]/i.test(event.location) ? "View location" : event.location}
                    </a>
                  ) : (
                    <span className="truncate">{event.location}</span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{formattedFull}</span>
              </span>
              {event.timeSlot && (
                <span className="flex items-center gap-1.5">
                  <Clock size={11} className="text-gray-400 shrink-0" />
                  <span className="truncate">{event.timeSlot}</span>
                </span>
              )}
              {durationDays > 1 && (
                <span className="text-[10px] font-bold text-[#00CDBA] pl-[17px] mt-0.5">
                  {durationDays} Days
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CTA Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          {isCompleted ? (
            event.highlightsUrl ? (
              <a
                href={event.highlightsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#111827] border-b border-[#111827] pb-0.5 hover:text-[#00CDBA] hover:border-[#00CDBA] transition-colors"
              >
                Highlights <ExternalLink size={10} />
              </a>
            ) : <div />
          ) : (
            <>
              {event.registrationUrl ? (
                (() => {
                  const finalUrl = parseLumaUrl(event.registrationUrl)!;
                  const isLuma = finalUrl.includes("lu.ma");
                  const eventIdMatch = finalUrl.match(/evt-[a-zA-Z0-9]+/);
                  const lumaEventId = isLuma && eventIdMatch ? eventIdMatch[0] : undefined;
                  return (
                    <a
                      href={finalUrl}
                      target={isLuma ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#00CDBA] border-b-2 border-[#00CDBA] pb-0.5 hover:text-[#111827] hover:border-[#111827] transition-colors"
                      data-luma-action={isLuma ? "checkout" : undefined}
                      data-luma-event-id={lumaEventId}
                    >
                      Register <ExternalLink size={10} />
                    </a>
                  );
                })()
              ) : (
                <Link
                  href={`/contact?event=${encodeURIComponent(event.title)}`}
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#00CDBA] border-b-2 border-[#00CDBA] pb-0.5 hover:text-[#111827] hover:border-[#111827] transition-colors"
                >
                  Register <ArrowRight size={10} />
                </Link>
              )}
              <ShareButton event={event} />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Memory Card (completed events) ── */
function MemoryCard({
  event,
  index,
  isHighlighted = false,
}: {
  event: any;
  index: number;
  isHighlighted?: boolean;
}) {
  let day = "01";
  let monthStr = "Jan";
  let yearStr = "";
  let durationDays = 1;
  let hasRange = false;

  try {
    const dateObj = new Date(event.date);
    if (!isNaN(dateObj.getTime())) {
      const startDayNum = dateObj.getDate();
      day = String(startDayNum).padStart(2, "0");
      monthStr = dateObj
        .toLocaleString("default", { month: "short" })
        .toUpperCase();
      yearStr = String(dateObj.getFullYear());

      if (event.endDate) {
        const endDateObj = new Date(event.endDate);
        if (!isNaN(endDateObj.getTime()) && endDateObj.toDateString() !== dateObj.toDateString()) {
          const endDayNum = endDateObj.getDate();
          
          const diffTime = Math.abs(endDateObj.getTime() - dateObj.getTime());
          durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

          day = `${startDayNum}-${endDayNum}`;
          hasRange = true;
        }
      }
    }
  } catch (_e) {}

  const formattedFull = formatEventDateRange(event.date, event.endDate, false);

  return (
    <motion.div
      id={event.id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full h-full relative"
      animate={isHighlighted ? {
        scale: [1, 1.04, 1.02],
        y: -6,
      } : { scale: 1, y: 0 }}
    >
      {/* Floating Highlight Badge */}
      {isHighlighted && (
        <div className="absolute -top-3 -right-2 z-30 flex items-center gap-1.5 bg-[#ff5c7a] text-white text-[9px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-lg shadow-[#ff5c7a]/30 border-2 border-white animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          Selected Event
        </div>
      )}
      <div className={`group flex flex-col h-full p-5 rounded-3xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
        isHighlighted
          ? "ring-4 ring-[#ff5c7a] border-[#ff5c7a] bg-gradient-to-br from-white to-[#ff5c7a]/5 shadow-[0_15px_40px_rgba(255,127,104,0.3)]"
          : "border-gray-200/60 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-gray-300"
      }`}>
        {/* Card Image */}
        <div
          style={{ aspectRatio: cardAspect(event), maxHeight: "15rem" }}
          className="relative w-full rounded-2xl overflow-hidden mb-5 border border-gray-100 shrink-0"
        >
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              <Calendar size={32} className="text-gray-300" />
            </div>
          )}

          {/* Date badge */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1 text-center shadow-sm">
            <p className={`font-headline font-bold text-[#111827] leading-none ${hasRange ? 'text-xs px-0.5' : 'text-base'}`}>
              {day}
            </p>
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-[#00CDBA] mt-0.5">
              {monthStr}
            </p>
            <p className="text-[6px] font-semibold text-gray-400 mt-0.5">
              {yearStr}
            </p>
          </div>

        </div>

        {/* Card Body */}
        <div className="flex-1 flex flex-col">
          <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 border border-gray-100">
              <Check size={10} strokeWidth={3} className="text-[#00CDBA]" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-600">
                Completed
              </span>
            </div>
          </div>
          <h3 className="font-headline text-base sm:text-lg text-[#111827] font-bold leading-snug mb-2 line-clamp-2 group-hover:text-[#00CDBA] transition-colors duration-300">
            {event.title}
          </h3>

          <div className="mt-auto flex flex-col gap-1.5 text-[11px] font-medium text-gray-500">
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={11} className="text-gray-400 shrink-0" />
                {event.mapUrl || /^https?:[/][/]/i.test(event.location) ? (
                  <a
                  href={event.mapUrl || event.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:underline"
                  >
                  {/^https?:[/][/]/i.test(event.location) ? "View location" : event.location}
                  </a>
                ) : (
                  <span className="truncate">{event.location}</span>
                )}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar size={11} className="text-gray-400 shrink-0" />
              <span className="truncate">{formattedFull}</span>
            </span>
            {event.timeSlot && (
              <span className="flex items-center gap-1.5">
                <Clock size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{event.timeSlot}</span>
              </span>
            )}
            {durationDays > 1 && (
              <span className="text-[10px] font-bold text-[#00CDBA] pl-[17px] mt-0.5">
                {durationDays} Days
              </span>
            )}
          </div>
        </div>

        {/* Action row */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          {event.highlightsUrl ? (
            <a
              href={event.highlightsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#111827] border-b border-[#111827] pb-0.5 hover:text-[#00CDBA] hover:border-[#00CDBA] transition-colors"
            >
              Highlights <ExternalLink size={10} />
            </a>
          ) : <div />}
          <ShareButton event={event} variant="light" />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Calendar ── */
function MonthGrid({ date, events }: { date: Date; events: any[] }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const activeDays = events.reduce((acc, event) => {
    try {
      const d = new Date(event.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        acc.push(d.getDate());
      }
    } catch (e) {}
    return acc;
  }, [] as number[]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = today.getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dayEvents = events.filter((event) => {
      try {
        const d = new Date(event.date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === i;
      } catch (e) {
        return false;
      }
    });
    
    const isActive = dayEvents.length > 0;
    const isToday = isCurrentMonth && i === todayDay;

    const handleDayClick = (e: React.MouseEvent) => {
      if (isActive && dayEvents[0]?.id) {
        e.preventDefault();
        const id = dayEvents[0].id;
        window.location.hash = id;
        
        // Scroll to element
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    cells.push(
      isActive && dayEvents[0] ? (
        <button
          key={`day-${i}`}
          onClick={handleDayClick}
          title={`Click to view: ${dayEvents[0].title}`}
          className="flex items-center justify-center w-[22px] h-[22px] mx-auto rounded-full text-[10px] font-black transition-all duration-200 bg-[#FFC107] text-[#111827] shadow-sm hover:scale-125 hover:shadow-md cursor-pointer border border-[#FFC107] outline-none"
        >
          {i}
        </button>
      ) : (
        <div
          key={`day-${i}`}
          className={`
            flex items-center justify-center w-[22px] h-[22px] mx-auto rounded-full text-[10px] font-bold transition-all duration-200
            ${isToday ? "ring-[1px] ring-[#FF5C7A] text-[#111827]" : "text-gray-700 hover:bg-black/5"}
          `}
        >
          {i}
        </div>
      )
    );
  }

  return (
    <div className="py-0.5">
      {/* Month Label */}
      <div className="text-[12px] font-bold text-[#FF5C7A] text-center mb-2.5">
        {monthNames[month]} {year}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
        {days.map((d) => (
          <div key={d} className="text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

function RealCalendar({ events }: { events: any[] }) {
  const [centerMonth, setCenterMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const prevMonth = new Date(centerMonth.getFullYear(), centerMonth.getMonth() - 1, 1);
  const nextMonth = new Date(centerMonth.getFullYear(), centerMonth.getMonth() + 1, 1);

  const handlePrev = () => {
    setCenterMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCenterMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Mobile Controls Row */}
      <div className="flex lg:hidden items-center justify-between w-full px-2 mb-1">
        <button
          onClick={handlePrev}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-[#FF5C7A] hover:text-[#FF5C7A]"
          aria-label="Previous Month"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
          Navigate
        </span>
        <button
          onClick={handleNext}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-[#FF5C7A] hover:text-[#FF5C7A]"
          aria-label="Next Month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Up Chevron (desktop only) */}
      <button
        onClick={handlePrev}
        className="hidden lg:flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 transition-colors text-[#FF5C7A] hover:text-[#FF5C7A]"
        title="Previous Month"
      >
        <ChevronUp size={20} />
      </button>

      {/* Three Months stacked vertically on desktop, horizontally scrollable on mobile */}
      <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible snap-x snap-mandatory gap-4 pb-1 lg:pb-0 scroll-smooth w-full">
        <div className="min-w-[180px] sm:min-w-[200px] lg:min-w-0 flex-1 shrink-0 snap-center bg-white border border-[#FF5C7A]/15 rounded-2xl p-3.5 shadow-sm shadow-[#FF5C7A]/3">
          <MonthGrid date={prevMonth} events={events} />
        </div>
        <div className="min-w-[180px] sm:min-w-[200px] lg:min-w-0 flex-1 shrink-0 snap-center bg-white border border-[#FF5C7A]/25 rounded-2xl p-3.5 shadow-sm shadow-[#FF5C7A]/5 ring-1 ring-[#FF5C7A]/10">
          <MonthGrid date={centerMonth} events={events} />
        </div>
        <div className="min-w-[180px] sm:min-w-[200px] lg:min-w-0 flex-1 shrink-0 snap-center bg-white border border-[#FF5C7A]/15 rounded-2xl p-3.5 shadow-sm shadow-[#FF5C7A]/3">
          <MonthGrid date={nextMonth} events={events} />
        </div>
      </div>

      {/* Down Chevron (desktop only) */}
      <button
        onClick={handleNext}
        className="hidden lg:flex items-center justify-center p-1.5 rounded-full hover:bg-gray-100 transition-colors text-[#FF5C7A] hover:text-[#FF5C7A]"
        title="Next Month"
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
}
