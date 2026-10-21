/**
 * Server-side reads for the pages people share: a form (an event page, in
 * practice) and a single event. Shared links need the title, the poster and
 * the details in the HTML itself, because WhatsApp, Instagram, Facebook,
 * LinkedIn and Slack all read the raw response and never run JavaScript.
 *
 * Uses the Firestore REST API rather than the web SDK, for the same reason as
 * events-seo.ts: the SDK's transport is unreliable in a server runtime, and
 * both collections are public-read, so an unauthenticated GET is enough.
 */

import type { Metadata } from "next";

const PROJECT_ID = "vetaas-7aeae";
const API_KEY = "AIzaSyCPX8GqGLLFDzRGnjhjJj_ovy88ulpK-D4";
const SITE_URL = "https://www.vetaas.in";

type RestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
};

type RestDoc = { name: string; fields?: Record<string, RestValue> };

const str = (v?: RestValue) => (typeof v?.stringValue === "string" ? v.stringValue : undefined);
const num = (v?: RestValue) => {
  if (!v) return undefined;
  if (typeof v.integerValue === "string") return Number(v.integerValue);
  if (typeof v.doubleValue === "number") return v.doubleValue;
  return undefined;
};

export interface SharedForm {
  title: string;
  description?: string;
  logoUrl?: string;
  eventDate?: string;
  eventStart?: string;
  eventEnd?: string;
  location?: string;
  locationNote?: string;
  hostName?: string;
  price?: number;
  status?: string;
}

export interface SharedEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  timeSlot?: string;
  location?: string;
  mapUrl?: string;
  image?: string;
  imageAspect?: number;
  registrationUrl?: string;
  highlightsUrl?: string;
  cancelled?: boolean;
}

/** One document, or null when it doesn't exist. Cached for ten minutes. */
async function fetchDoc(collection: string, id: string): Promise<RestDoc | null> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/${collection}/${encodeURIComponent(id)}?key=${API_KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    return (await res.json()) as RestDoc;
  } catch (err) {
    console.error(`Could not read ${collection}/${id}:`, err);
    return null;
  }
}

export async function fetchForm(formId: string): Promise<SharedForm | null> {
  const doc = await fetchDoc("forms", formId);
  const f = doc?.fields;
  if (!f) return null;
  const title = str(f.title);
  if (!title) return null;
  return {
    title,
    description: str(f.description),
    logoUrl: str(f.logoUrl),
    eventDate: str(f.eventDate),
    eventStart: str(f.eventStart),
    eventEnd: str(f.eventEnd),
    location: str(f.location),
    locationNote: str(f.locationNote),
    hostName: str(f.hostName),
    price: num(f.price),
    status: str(f.status),
  };
}

export async function fetchEvent(eventId: string): Promise<SharedEvent | null> {
  const doc = await fetchDoc("events", eventId);
  const f = doc?.fields;
  if (!f) return null;
  const title = str(f.title);
  const date = str(f.date);
  if (!title || !date) return null;
  return {
    id: eventId,
    title,
    date,
    endDate: str(f.endDate),
    timeSlot: str(f.timeSlot),
    location: str(f.location),
    mapUrl: str(f.mapUrl),
    image: str(f.image),
    imageAspect: num(f.imageAspect),
    registrationUrl: str(f.registrationUrl),
    highlightsUrl: str(f.highlightsUrl),
    cancelled: f.cancelled?.booleanValue === true,
  };
}

const to12h = (hhmm?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};

/** Today in India, as "2026-10-21", for comparing against event dates. */
export function istToday(): string {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

/** "Thursday, 24 September 2026" from "2026-09-24". */
export function prettyDay(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(
    "en-IN",
    { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );
}

export const prettyTime = (start?: string, end?: string) => {
  const from = to12h(start);
  if (!from) return "";
  const to = to12h(end);
  return to ? `${from} – ${to}` : from;
};

/**
 * The one-line summary under a shared link: when it is, where it is, and what
 * a ticket costs. Falls back to the admin's own description.
 */
export function shareDescription(parts: {
  description?: string;
  day?: string;
  time?: string;
  location?: string;
  price?: number;
}): string {
  const facts = [
    [parts.day, parts.time].filter(Boolean).join(", "),
    parts.location,
    parts.price && parts.price > 0 ? `₹${parts.price.toLocaleString("en-IN")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const written = (parts.description ?? "").trim().replace(/\s+/g, " ");
  if (facts && written) return `${facts} — ${written}`.slice(0, 300);
  return (facts || written || "An event by Vetaas Education Foundation, J. P. Nagar, Bengaluru.").slice(0, 300);
}

/**
 * Open Graph and Twitter tags for a shared page. A poster makes the link
 * unfurl as a large image card; without one, the site logo stands in.
 */
export function shareMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  // Some older events hold their poster as embedded base64, which no social
  // platform can fetch — only a real https address is worth offering.
  const usable = image && /^https:\/\/\S+$/i.test(image) ? image : `${SITE_URL}/logo.webp`;
  const images = [usable];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      siteName: "Vetaas Education Foundation",
      type: "website",
      images: images.map((url) => ({ url, alt: title })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
