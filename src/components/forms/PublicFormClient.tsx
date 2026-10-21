"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, storage } from "@/lib/firebase";
import { loadRazorpayScript, openRazorpay } from "@/lib/razorpay";
import {
  FILE_UPLOAD_ACCEPT,
  FILE_UPLOAD_MAX_BYTES,
  GRID_FIELD_TYPES,
  emptyAnswer,
  fileNameFromPath,
  fileNameFromUrl,
  isAnswerEmpty,
  isStoragePath,
  type AnswerValue,
  type FormDoc,
  type FormField,
  type GridAnswer,
} from "@/lib/forms";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Star,
  Ticket,
  Upload,
  X,
} from "lucide-react";
import {
  confirmationEnabled,
  eventWhen,
  isEventForm,
  locationText,
  mapLink,
  newTicketToken,
  registrantEmail,
} from "@/lib/tickets";

const EMAIL_RE = /.+@.+\..+/;

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};

const createEventRegistration = httpsCallable<
  { formId: string; answers: Record<string, AnswerValue> },
  {
    ticketToken: string | null;
    responseId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }
>(functions, "createEventRegistration");

const verifyEventPayment = httpsCallable<
  {
    responseId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  { ok: boolean; ticketToken: string | null }
>(functions, "verifyEventPayment");

const fmtPrice = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const respondedKey = (formId: string) => `formResponded:${formId}`;
// Remembers this device's ticket so "View my ticket" survives a reload.
const ticketKey = (formId: string) => `formTicket:${formId}`;

export default function PublicFormClient({ formId }: { formId: string }) {

  const [form, setForm] = useState<FormDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  // Landing view first, questions after they click Register.
  const [registering, setRegistering] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [ticketToken, setTicketToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ticketKey(formId));
      if (saved) setTicketToken(saved);
    } catch {}
  }, [formId]);

  const rememberTicket = (token: string | null) => {
    if (!token) return;
    setTicketToken(token);
    try {
      localStorage.setItem(ticketKey(formId), token);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "forms", formId));
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          const data = snap.data() as FormDoc;
          setForm(data);
          if (data.limitOneResponse) {
            try {
              if (localStorage.getItem(respondedKey(formId))) setAlreadyResponded(true);
            } catch {}
          }
        }
      } catch (err) {
        console.error("Failed to load form:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [formId]);

  // While the registration dialog is open, close it on Escape and stop the
  // page behind it from scrolling.
  useEffect(() => {
    if (!registering) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRegistering(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [registering]);

  const price = Math.round(Number(form?.price) || 0);

  const setValue = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => ({ ...prev, [fieldId]: false }));
  };

  const toggleCheckbox = (fieldId: string, option: string, checked: boolean) => {
    const current = (answers[fieldId] as string[]) ?? [];
    setValue(fieldId, checked ? [...current, option] : current.filter((o) => o !== option));
  };

  const submit = async () => {
    if (!form) return;
    const nextErrors: Record<string, boolean> = {};
    form.fields.forEach((field) => {
      const value = answers[field.id];
      if (field.required && isAnswerEmpty(field, value)) {
        nextErrors[field.id] = true;
      } else if (field.type === "email" && typeof value === "string" && value.trim() && !EMAIL_RE.test(value.trim())) {
        nextErrors[field.id] = true;
      }
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(false);
    setPayError(null);
    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {}
      }

      if (price > 0) {
        await payThenRegister();
        return;
      }

      // Events get a ticket. The token is made here so the ticket link can be
      // shown straight away; the server issues the ticket and emails it.
      const token = isEventForm(form) ? newTicketToken() : null;
      await addDoc(collection(db, "formResponses"), {
        formId,
        formTitle: form.title,
        answers: form.fields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          value: answers[field.id] ?? emptyAnswer(field),
        })),
        ...(token ? { ticketToken: token } : {}),
        createdAt: serverTimestamp(),
      });
      markResponded();
      rememberTicket(token);
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit form:", err);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const markResponded = () => {
    if (!form?.limitOneResponse) return;
    try {
      localStorage.setItem(respondedKey(formId), "1");
    } catch {}
  };

  /**
   * Paid registration. The Cloud Function writes the response document and
   * creates the Razorpay order from the price stored on the form, so the
   * amount is never taken from this page. The registration only counts once
   * the signature has been verified server-side — the webhook does the same
   * job independently if the visitor closes the tab mid-payment.
   */
  const payThenRegister = async () => {
    if (!form) return;
    try {
      await loadRazorpayScript();
      const { data: order } = await createEventRegistration({
        formId,
        answers: form.fields.reduce<Record<string, AnswerValue>>((acc, field) => {
          acc[field.id] = answers[field.id] ?? emptyAnswer(field);
          return acc;
        }, {}),
      });

      const rzp = openRazorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: form.hostName?.trim() || "Vetaas Education Foundation",
        description: form.title || "Event registration",
        order_id: order.razorpayOrderId,
        theme: { color: "#7C3AED" },
        handler: async (response) => {
          try {
            const { data: verified } = await verifyEventPayment({
              responseId: order.responseId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            markResponded();
            rememberTicket(verified.ticketToken ?? order.ticketToken);
            setSubmitted(true);
          } catch (err) {
            console.error("Payment verification failed:", err);
            // The ticket still goes live once the webhook confirms payment.
            rememberTicket(order.ticketToken);
            // The webhook still confirms it, so don't tell them it failed.
            setPayError(
              "Payment received, but confirming it took longer than expected. We'll be in touch — no need to pay again."
            );
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          },
        },
      });

      rzp.on("payment.failed", (event) => {
        const reason = event?.error?.description;
        setPayError(
          `Payment didn't go through${reason ? ` — ${reason}` : ""}. If money was debited it will be refunded automatically within 5–7 days.`
        );
        setSubmitting(false);
      });

      rzp.open();
    } catch (err) {
      console.error("Couldn't start payment:", err);
      setPayError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't start the payment. Please try again."
      );
      setSubmitting(false);
    }
  };

  const shell = (content: React.ReactNode, wide = false) => (
    <div className="min-h-screen form-shell pt-8 pb-24 px-6">
      <div className={`${wide ? "max-w-5xl" : "max-w-2xl"} mx-auto`}>{content}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[#7C3AED]" size={28} />
      </div>
    );
  }

  if (notFound || !form) {
    return shell(
      <div className="text-center py-24">
        <p className="text-gray-500 font-medium">This form doesn&apos;t exist.</p>
      </div>
    );
  }

  if (alreadyResponded && !submitted) {
    return shell(
      <div className="glass-card rounded-3xl p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-[#00CDBA]" size={36} />
        <h1 className="text-xl font-headline font-bold text-[#111827] mb-2">
          {form.title || "This form"}
        </h1>
        <p className="text-gray-500 font-medium">You&apos;ve already responded to this form.</p>
        {ticketToken && (
          <a
            href={`/ticket/${ticketToken}`}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#7C3AED] text-white font-bold rounded-lg hover:bg-[#6D28D9] transition-colors"
          >
            <Ticket size={16} /> View my ticket
          </a>
        )}
      </div>
    );
  }

  if (form.status === "closed") {
    return shell(
      <div className="glass-card rounded-3xl p-10 text-center">
        <Lock className="mx-auto mb-4 text-gray-300" size={36} />
        <h1 className="text-xl font-headline font-bold text-[#111827] mb-2">
          {form.title || "This form"}
        </h1>
        <p className="text-gray-500 font-medium">This form is no longer accepting responses.</p>
      </div>
    );
  }

  if (submitted) {
    const emailing = confirmationEnabled(form);
    const sentTo = registrantEmail(
      form.fields.map((f) => ({ fieldId: f.id, label: f.label, value: answers[f.id] ?? "" }))
    );
    return shell(
      <div className="glass-card rounded-3xl p-10 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-[#00CDBA]" size={40} />
        <h1 className="text-xl font-headline font-bold text-[#111827] mb-2">
          {ticketToken ? "You're in!" : "Thank you!"}
        </h1>
        <p className="text-gray-500 font-medium">
          {ticketToken
            ? `You're registered for ${form.title || "this event"}.`
            : "Your response has been recorded."}
        </p>
        {emailing && (sentTo || price > 0) && (
          <p className="text-sm text-gray-500 mt-2">
            {sentTo ? (
              <>
                We&apos;ve emailed {ticketToken ? "your ticket" : "a confirmation"} to{" "}
                <span className="font-semibold text-gray-700">{sentTo}</span>.
              </>
            ) : (
              "We've emailed your ticket to the address you used at payment."
            )}
          </p>
        )}
        {ticketToken && (
          <a
            href={`/ticket/${ticketToken}`}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#7C3AED] text-white font-bold rounded-lg hover:bg-[#6D28D9] transition-colors"
          >
            <Ticket size={16} /> View my ticket
          </a>
        )}
      </div>
    );
  }

  const when = eventWhen(form);
  const timeRange = when?.time ?? "";
  const maps = mapLink(form);
  const where = locationText(form);
  // A date or a location is what makes this an event. Without either it's an
  // ordinary form — info gathering, feedback, a sign-up — so the questions go
  // straight on screen instead of behind a Register button.
  const isEvent = !!(when || form.location);
  const hasRail = !!(form.logoUrl || form.hostName);

  // Square cover + host. Shared by both layouts so a poster is framed the same
  // way whether or not the form happens to be an event.
  const coverRail = (
    <aside className="space-y-5">
      {form.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.logoUrl}
          alt=""
          className="w-full aspect-square object-cover rounded-2xl border border-gray-100 shadow-sm"
        />
      )}
      {form.hostName && (
        <div className="glass-card rounded-2xl px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Presented by
          </p>
          <p className="font-bold text-[#111827]">{form.hostName}</p>
        </div>
      )}
      {where && (
        // Google's keyless embed, so there's no Maps billing to manage. It
        // loads only when scrolled into view.
        <div className="glass-card rounded-2xl overflow-hidden">
          <iframe
            title={`Map of ${form.location || "the venue"}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(where)}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-48 border-0 block"
          />
          {maps && (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-[#111827] hover:bg-white/60 transition-colors"
            >
              <span className="truncate">Open in Google Maps</span>
              <ArrowUpRight size={15} className="text-gray-400 shrink-0" />
            </a>
          )}
        </div>
      )}
    </aside>
  );

  const questions = (
    <>
      <div className="space-y-4">
        {form.fields.map((field) => (
          <FieldInput
            key={field.id}
            formId={formId}
            field={field}
            value={answers[field.id]}
            error={!!errors[field.id]}
            onChange={(v) => setValue(field.id, v)}
            onToggleCheckbox={(opt, checked) => toggleCheckbox(field.id, opt, checked)}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-8 py-3 bg-[#7C3AED] text-white font-bold rounded-lg hover:bg-[#6D28D9] transition-colors disabled:opacity-60 cursor-pointer"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Submit
        </button>
        {submitError && (
          <span className="text-sm font-semibold text-red-500">
            Something went wrong — try again.
          </span>
        )}
      </div>
    </>
  );

  if (!isEvent) {
    // No cover and no host: nothing to put in a rail, so keep the compact
    // single-column form.
    if (!hasRail) {
      return shell(
        <>
          <div className="glass-card rounded-3xl p-8 mb-4">
            <h1 className="text-2xl sm:text-3xl font-headline font-bold text-[#111827] tracking-tight mb-2">
              {form.title || "Untitled form"}
            </h1>
            {form.description && (
              <p className="text-gray-500 font-medium leading-relaxed whitespace-pre-line">
                {form.description}
              </p>
            )}
          </div>
          {questions}
        </>
      );
    }

    return shell(
      <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
        {coverRail}
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-[#111827] tracking-tight leading-[1.1] mb-4">
            {form.title || "Untitled form"}
          </h1>
          {form.description && (
            <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-line mb-8">
              {form.description}
            </p>
          )}
          {questions}
        </div>
      </div>,
      true
    );
  }

  // Opened by the Register button. Kept as an overlay so the event details stay
  // behind it, the way Luma does it.
  const registerDialog = registering ? (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => setRegistering(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${form.ctaLabel?.trim() || "Register"} — ${form.title || "form"}`}
        className="relative w-full max-w-lg my-auto glass-solid rounded-2xl shadow-xl max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-[#111827]">Your Info</h2>
          <button
            onClick={() => setRegistering(false)}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {form.fields.map((field) => (
            <FieldInput
              key={field.id}
              formId={formId}
              field={field}
              value={answers[field.id]}
              error={!!errors[field.id]}
              onChange={(v) => setValue(field.id, v)}
              onToggleCheckbox={(opt, checked) => toggleCheckbox(field.id, opt, checked)}
              bare
            />
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 flex-grow px-8 py-3 bg-[#7C3AED] text-white font-bold rounded-lg hover:bg-[#6D28D9] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {price > 0 ? `Pay ${fmtPrice(price)} & register` : "Submit"}
          </button>
          {submitError && (
            <span className="text-sm font-semibold text-red-500">Try again.</span>
          )}
        </div>

        {payError && (
          <div className="px-6 pb-4 -mt-1 shrink-0">
            <p className="text-[13px] font-semibold text-red-500 leading-relaxed">{payError}</p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return shell(
    <>
    <div
      className={`grid gap-8 lg:gap-12 items-start ${
        hasRail ? "lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]" : "max-w-2xl mx-auto"
      }`}
    >
      {hasRail && coverRail}

      {/* Main column */}
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-headline font-bold text-[#111827] tracking-tight leading-[1.1] mb-6">
          {form.title || "Untitled form"}
        </h1>

        {(when || form.location) && (
          <div className="space-y-3 mb-7">
            {when && (
              <div className="flex items-center gap-3.5">
                <div className="w-12 shrink-0 rounded-xl glass-card overflow-hidden text-center">
                  <div className="bg-white/50 text-[9px] font-bold uppercase tracking-wider text-gray-400 py-0.5">
                    {when.month}
                  </div>
                  <div className="text-lg font-bold text-[#111827] leading-7">{when.day}</div>
                </div>
                <div>
                  <p className="font-bold text-[#111827] leading-snug">{when.full}</p>
                  {timeRange && (
                    <p className="text-sm text-gray-500 font-medium">{timeRange}</p>
                  )}
                </div>
              </div>
            )}

            {form.location && (
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 shrink-0 rounded-xl glass-card flex items-center justify-center text-gray-400">
                  <MapPin size={18} />
                </div>
                <div>
                  {maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#111827] leading-snug hover:underline"
                    >
                      {form.location}
                      <ArrowUpRight size={15} className="text-gray-400 shrink-0" />
                    </a>
                  ) : (
                    <p className="font-bold text-[#111827] leading-snug">{form.location}</p>
                  )}
                  {form.locationNote && (
                    <p className="text-sm text-gray-500 font-medium">{form.locationNote}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Registration — swaps to the questions once they click through */}
        <div className="glass-card rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-3 bg-white/40 border-b border-white/60">
            <p className="text-sm font-bold text-[#111827]">Registration</p>
          </div>
          <div className="p-6">
            {price > 0 && (
              <div className="flex items-baseline justify-between gap-4 pb-4 mb-4 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-500">Ticket</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">
                  {fmtPrice(price)}
                </span>
              </div>
            )}
            <p className="text-gray-500 font-medium mb-5">
              {price > 0
                ? "Welcome! Register and pay below to confirm your place."
                : "Welcome! To join, please register below."}
            </p>
            <button
              onClick={() => setRegistering(true)}
              className="w-full px-8 py-3.5 bg-[#7C3AED] text-white font-bold rounded-lg hover:bg-[#6D28D9] transition-colors cursor-pointer"
            >
              {form.ctaLabel?.trim() || "Register"}
            </button>
          </div>
        </div>

        {form.description && (
          <section>
            <h2 className="text-sm font-bold text-[#111827] pb-2 mb-4 border-b border-gray-200">
              About
            </h2>
            <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-line">
              {form.description}
            </p>
          </section>
        )}
      </div>
    </div>
    {registerDialog}
    </>,
    true
  );
}

function FieldInput({
  formId,
  field,
  value,
  error,
  onChange,
  onToggleCheckbox,
  bare = false,
}: {
  formId: string;
  field: FormField;
  value: AnswerValue | undefined;
  error: boolean;
  onChange: (v: AnswerValue) => void;
  onToggleCheckbox: (option: string, checked: boolean) => void;
  /** Drop the card chrome when already inside one. */
  bare?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Shared by image and file questions. The original name is kept, made safe,
  // in the storage path so the responses view can show what was uploaded.
  const upload = async (file: File) => {
    setUploadError(null);
    if (file.size > FILE_UPLOAD_MAX_BYTES) {
      setUploadError("That file is over 10 MB. Please choose a smaller one.");
      return;
    }
    setUploading(true);
    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {}
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      // Some browsers leave the type blank for office files; storage rules
      // check it, so fill it in from the extension.
      const contentType = file.type || EXTENSION_TYPES[ext];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
      // A random part makes the path unguessable, and the answer keeps the
      // path rather than a shareable download link — only the admin panel can
      // read these files back.
      const secret = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const path = `formUploads/${formId}/${field.id}-${Date.now()}-${secret}-${safeName}`;
      await uploadBytes(storageRef(storage, path), file, contentType ? { contentType } : undefined);
      onChange(path);
    } catch (err) {
      console.error("Failed to upload file:", err);
      setUploadError(
        "Upload failed. Please use a PDF, Word, Excel, PowerPoint, text or image file and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={bare ? "" : "glass-card rounded-2xl p-6"}>
      <label className="block font-semibold text-[#111827] mb-3">
        {field.label || "Untitled question"}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === "short_text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border-b ${error ? "border-red-400" : "border-gray-200"} focus:outline-none focus:border-[#7C3AED] py-2 text-sm text-gray-800`}
        />
      )}

      {field.type === "email" && (
        <input
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@example.com"
          className={`w-full border-b ${error ? "border-red-400" : "border-gray-200"} focus:outline-none focus:border-[#7C3AED] py-2 text-sm text-gray-800 placeholder:text-gray-300`}
        />
      )}

      {field.type === "paragraph" && (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`w-full border ${error ? "border-red-400" : "border-gray-200"} rounded-lg focus:outline-none focus:border-[#7C3AED] p-3 text-sm text-gray-800 resize-none`}
        />
      )}

      {field.type === "multiple_choice" && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 text-sm text-gray-700 font-medium cursor-pointer">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-[#7C3AED]"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.type === "checkboxes" && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 text-sm text-gray-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={((value as string[]) ?? []).includes(opt)}
                onChange={(e) => onToggleCheckbox(opt, e.target.checked)}
                className="accent-[#7C3AED]"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.type === "dropdown" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border ${error ? "border-red-400" : "border-gray-200"} rounded-lg focus:outline-none focus:border-[#7C3AED] p-2.5 text-sm text-gray-800 cursor-pointer`}
        >
          <option value="" disabled>
            Select…
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "file_upload" && (
        <div>
          {typeof value === "string" && value ? (
            <div className="flex items-center gap-3 max-w-md rounded-lg border border-gray-200 px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-[#7C3AED]" />
              <span className="text-sm font-medium text-gray-800 truncate">
                {isStoragePath(value) ? fileNameFromPath(value) : fileNameFromUrl(value)}
              </span>
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Remove file"
                className="ml-auto text-gray-400 hover:text-red-500 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <label
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed ${
                error ? "border-red-400" : "border-gray-300"
              } text-sm font-semibold text-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors cursor-pointer`}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Uploading…" : "Add file"}
              <input
                type="file"
                accept={FILE_UPLOAD_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p className="text-xs text-gray-400 mt-2">
            PDF, Word, Excel, PowerPoint, text or image, up to 10 MB.
          </p>
          {uploadError && <p className="text-xs font-semibold text-red-500 mt-1">{uploadError}</p>}
        </div>
      )}

      {field.type === "linear_scale" && <ScaleInput field={field} value={value} onChange={onChange} />}

      {field.type === "rating" && <RatingInput field={field} value={value} onChange={onChange} />}

      {GRID_FIELD_TYPES.includes(field.type) && (
        <GridInput field={field} value={value} onChange={onChange} />
      )}

      {(field.type === "date" || field.type === "time") && (
        <input
          type={field.type}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`border ${
            error ? "border-red-400" : "border-gray-200"
          } rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#7C3AED]`}
        />
      )}

      {error && (
        <p className="text-xs font-semibold text-red-500 mt-2">
          {field.type === "email" && value
            ? "Enter a valid email address."
            : GRID_FIELD_TYPES.includes(field.type)
              ? "Please answer every row."
              : "This question is required."}
        </p>
      )}
    </div>
  );
}

type InputProps = {
  field: FormField;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
};

function ScaleInput({ field, value, onChange }: InputProps) {
  const min = field.scaleMin === 0 ? 0 : 1;
  const max = Math.max(min + 1, field.scaleMax ?? 5);
  const steps = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-4 min-w-max py-1">
        {field.minLabel && (
          <span className="max-w-[7rem] pb-1 text-xs text-gray-500">{field.minLabel}</span>
        )}
        {steps.map((step) => (
          <label
            key={step}
            className="flex flex-col items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer"
          >
            <span>{step}</span>
            <input
              type="radio"
              name={field.id}
              checked={value === step}
              onChange={() => onChange(step)}
              className="w-4 h-4 accent-[#7C3AED] cursor-pointer"
            />
          </label>
        ))}
        {field.maxLabel && (
          <span className="max-w-[7rem] pb-1 text-xs text-gray-500">{field.maxLabel}</span>
        )}
      </div>
    </div>
  );
}

function RatingInput({ field, value, onChange }: InputProps) {
  const max = field.ratingMax ?? 5;
  const current = typeof value === "string" ? Number(value) || 0 : 0;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={field.label || "Rating"}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const filled = current >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} out of ${max}`}
            onClick={() => onChange(current === n ? "" : String(n))}
            className="p-0.5 rounded cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
          >
            <Star
              size={28}
              className={filled ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}
              fill={filled ? "currentColor" : "none"}
            />
          </button>
        );
      })}
    </div>
  );
}

function GridInput({ field, value, onChange }: InputProps) {
  const rows = field.rows ?? [];
  const columns = field.columns ?? [];
  const multi = field.type === "checkbox_grid";
  const grid: GridAnswer = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const setCell = (row: string, column: string, checked: boolean) => {
    const next: GridAnswer = { ...grid };
    if (multi) {
      const current = Array.isArray(next[row]) ? (next[row] as string[]) : [];
      next[row] = checked ? [...current, column] : current.filter((c) => c !== column);
    } else {
      next[row] = column;
    }
    onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="p-2" />
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="p-2 text-center text-xs font-semibold text-gray-500 whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-t border-gray-100">
              <th scope="row" className="p-2 pr-4 text-left font-medium text-gray-700">
                {row}
              </th>
              {columns.map((column) => {
                const cell = grid[row];
                const on = multi ? Array.isArray(cell) && cell.includes(column) : cell === column;
                return (
                  <td key={column} className="p-2 text-center">
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={`${field.id}-${row}`}
                      checked={on}
                      onChange={(e) => setCell(row, column, e.target.checked)}
                      aria-label={`${row}: ${column}`}
                      className="w-4 h-4 accent-[#7C3AED] cursor-pointer"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
