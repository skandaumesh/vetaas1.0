import type { Metadata } from "next";
import PublicFormClient from "@/components/forms/PublicFormClient";
import {
  fetchForm,
  prettyDay,
  prettyTime,
  shareDescription,
  shareMetadata,
} from "@/lib/share-seo";

/**
 * Server wrapper around the form. The form itself renders in the browser, so
 * without this a shared link had nothing to unfurl — WhatsApp, Instagram and
 * the rest read the raw HTML and never run JavaScript. This puts the event's
 * own title, details and poster into the response.
 */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ formId: string }>;
}): Promise<Metadata> {
  const { formId } = await params;
  const form = await fetchForm(formId);
  if (!form) {
    return { title: "Form | Vetaas", robots: { index: false, follow: false } };
  }

  const closed = form.status === "closed";

  return shareMetadata({
    title: closed ? `${form.title} (closed)` : form.title,
    description: shareDescription({
      description: form.description,
      day: prettyDay(form.eventDate),
      time: prettyTime(form.eventStart, form.eventEnd),
      location: [form.location, form.locationNote].filter(Boolean).join(", "),
      price: form.price,
    }),
    path: `/forms/${formId}`,
    image: form.logoUrl,
  });
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  return <PublicFormClient formId={formId} />;
}
