"use client";

import { motion } from "framer-motion";
import { BookOpen, Film, MessageCircle, Scissors } from "lucide-react";

// TODO: replace each `whatsapp` value with the real WhatsApp group invite link
// (open the group → Group info → Invite via link → Copy link).
const CLUBS = [
  {
    title: "Book Club",
    tag: "Adults only",
    description:
      "A cosy circle for adult readers — we pick a book, read at our own pace, and meet to talk about what stayed with us.",
    whatsapp: "https://chat.whatsapp.com/HRMTL2a88UBFF3R7KTcGAG",
    accent: "#7C3AED",
    tint: "#f5f3ff",
    icon: BookOpen,
  },
  {
    title: "Crochet Club",
    tag: "Adults & children",
    description:
      "Learn to crochet from scratch or bring your work-in-progress. Open to adults and children, with yarn, patterns and plenty of company — no experience needed.",
    whatsapp: "https://chat.whatsapp.com/REPLACE_WITH_CROCHET_LINK",
    accent: "#FF5C7A",
    tint: "#fff0f2",
    icon: Scissors,
  },
  {
    title: "Movie Screening",
    tag: "Adults only",
    description:
      "Thoughtfully chosen films for grown-ups, screened at The Nest, followed by an open conversation over chai about what we watched.",
    whatsapp: "https://chat.whatsapp.com/REPLACE_WITH_MOVIE_LINK",
    accent: "#00CDBA",
    tint: "#effcf9",
    icon: Film,
  },
];

export default function ClubSection() {
  return (
    <main className="min-h-screen bg-white pt-[calc(var(--header-height)+2.5rem)] pb-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mb-14">
          <span className="inline-block py-1.5 px-5 rounded-full bg-white border border-gray-200 text-[#7C3AED] font-bold text-[10px] tracking-[0.2em] uppercase shadow-sm mb-5">
            Community Clubs
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold text-[#111827] leading-[1.15] tracking-tight">
            Find your people at{" "}
            <span className="text-[#7C3AED]">The Nest.</span>
          </h1>
          <p className="text-gray-500 font-medium text-base md:text-lg mt-5 leading-relaxed">
            Small, warm groups that meet regularly around something we love. Join the WhatsApp
            group for a club and we&apos;ll share the schedule and updates there.
          </p>
        </div>

        {/* Club cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {CLUBS.map((club, i) => {
            const Icon = club.icon;
            return (
              <motion.div
                key={club.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex"
              >
                <div
                  className="flex flex-col w-full rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
                  style={{ backgroundColor: club.tint }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <span
                      className="flex items-center justify-center w-12 h-12 rounded-2xl text-white shadow-sm"
                      style={{ backgroundColor: club.accent }}
                    >
                      <Icon size={20} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {club.tag}
                    </span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-extrabold text-[#111827] mb-3 leading-snug">
                    {club.title}
                  </h2>
                  <p className="text-gray-500 font-medium text-sm md:text-base leading-relaxed flex-grow">
                    {club.description}
                  </p>

                  <a
                    href={club.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-white font-bold text-sm hover:brightness-105 hover:scale-[1.02] transition-all shadow-md"
                    style={{ backgroundColor: club.accent }}
                  >
                    <MessageCircle size={16} />
                    Join Group
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
