import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";
import {
  fetchEvent,
  istToday,
  prettyDay,
  shareDescription,
  shareMetadata,
  type SharedEvent,
} from "@/lib/share-seo";

/**
 * A page per event, so a shared link unfurls with that event's poster and
 * details instead of the site logo. The events list links here, and the Share
 * button copies this address.
 */
export const revalidate = 600;

const summaryOf = (event: SharedEvent) =>
  shareDescription({
    day: prettyDay(event.date) + (event.endDate ? ` – ${prettyDay(event.endDate)}` : ""),
    time: event.timeSlot,
    location: event.location,
  });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await fetchEvent(eventId);
  if (!event) {
    return { title: "Event | Vetaas", robots: { index: false, follow: false } };
  }
  return shareMetadata({
    title: event.cancelled ? `${event.title} (cancelled)` : event.title,
    description: summaryOf(event),
    path: `/events/${eventId}`,
    image: event.image,
  });
}

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await fetchEvent(eventId);
  if (!event) notFound();

  const isPast = (event.endDate ?? event.date) < istToday();
  const aspect = Math.max(1.4, event.imageAspect || 16 / 10);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.date,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: event.cancelled
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `https://www.vetaas.in/events/${eventId}`,
    ...(event.image ? { image: event.image } : {}),
    description: summaryOf(event),
    location: {
      "@type": "Place",
      name: event.location || "The Nest by Vetaas",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Dhanalakshmi Building, D21, Kanakapura Main Road, J. P. Nagar",
        addressLocality: "Bengaluru",
        addressRegion: "Karnataka",
        postalCode: "560078",
        addressCountry: "IN",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Vetaas Education Foundation",
      url: "https://www.vetaas.in",
    },
    ...(event.registrationUrl && !event.cancelled
      ? {
          offers: {
            "@type": "Offer",
            url: event.registrationUrl,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <main className="min-h-screen bg-[#FFF9E6]/40 py-10 md:py-14 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />

      <div className="max-w-3xl mx-auto">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={15} /> All events
        </Link>

        <article className="rounded-3xl border border-[#00CDBA]/25 bg-white shadow-[0_4px_20px_rgba(54,186,152,0.05)] overflow-hidden">
          {event.image && (
            <div
              style={{ aspectRatio: String(aspect), maxHeight: "22rem" }}
              className="relative w-full border-b border-gray-100"
            >
              <Image
                src={event.image}
                alt={event.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  event.cancelled
                    ? "bg-rose-100 text-rose-700"
                    : isPast
                      ? "bg-gray-100 text-gray-500"
                      : "bg-[#00CDBA]/15 text-[#0f8d82]"
                }`}
              >
                {event.cancelled ? "Cancelled" : isPast ? "Completed" : "Upcoming"}
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-headline font-bold text-[#111827] tracking-tight leading-[1.12] mb-5">
              {event.title}
            </h1>

            <div className="flex flex-col gap-3 text-[15px] text-gray-700">
              <p className="flex items-start gap-3">
                <CalendarDays size={18} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="font-semibold">
                  {prettyDay(event.date)}
                  {event.endDate && event.endDate !== event.date
                    ? ` – ${prettyDay(event.endDate)}`
                    : ""}
                </span>
              </p>
              {event.timeSlot && (
                <p className="flex items-start gap-3">
                  <Clock size={18} className="mt-0.5 shrink-0 text-gray-400" />
                  <span>{event.timeSlot}</span>
                </p>
              )}
              {event.location && (
                <p className="flex items-start gap-3">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-gray-400" />
                  {event.mapUrl ? (
                    <a
                      href={event.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      {event.location}
                      <ArrowUpRight size={14} className="text-gray-400" />
                    </a>
                  ) : (
                    <span>{event.location}</span>
                  )}
                </p>
              )}
            </div>

            {event.cancelled && (
              <p className="mt-6 rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-sm text-rose-900">
                This event has been cancelled. Do check the events page for what else is coming up.
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              {!event.cancelled && !isPast && event.registrationUrl && (
                <a
                  href={event.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#7C3AED] text-white font-bold rounded-full hover:bg-[#6D28D9] transition-colors"
                >
                  Register
                  <ArrowUpRight size={16} />
                </a>
              )}
              {isPast && event.highlightsUrl && (
                <a
                  href={event.highlightsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-[#111827] font-bold rounded-full hover:bg-gray-50 transition-colors"
                >
                  <Sparkles size={16} className="text-[#F59E0B]" />
                  See highlights
                </a>
              )}
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-[#111827] font-bold rounded-full hover:bg-gray-50 transition-colors"
              >
                More events
              </Link>
            </div>
          </div>
        </article>

        <p className="text-center text-sm text-gray-500 mt-8">
          Social and emotional learning at The Nest, J. P. Nagar, Bengaluru ·{" "}
          <Link href="/" className="font-semibold text-[#7C3AED] hover:underline">
            vetaas.in
          </Link>
        </p>
      </div>
    </main>
  );
}
