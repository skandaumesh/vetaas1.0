"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import WaveDivider from "@/components/decor/WaveDivider";

type Partner = {
  name: string;
  /**
   * Real logo path. Drop the file into /public/partners/ and set it here,
   * e.g. logo: "/partners/acme.png". While this is undefined the tile falls
   * back to a numbered placeholder mark.
   */
  logo?: string;
};

/**
 * Ordered so wide wordmarks and compact/stacked marks alternate, which keeps
 * the strip from bunching up. Paths point at /collab/trimmed/, where the
 * originals have had their internal whitespace cropped off — several shipped
 * with heavy padding (Brainy Stars was only 16% artwork), which made them
 * render far smaller than the rest at the same height cap. Add or remove entries freely; the marquee
 * duplicates whatever is here to make the loop seamless.
 */
const partners: Partner[] = [
  { name: "Ekya Schools", logo: "/collab/trimmed/ekya.png" },
  { name: "Kahaani Box", logo: "/collab/trimmed/kahaani.png" },
  { name: "Delhi Public School, Bangalore South", logo: "/collab/trimmed/dps.png" },
  { name: "GRAT Lab", logo: "/collab/trimmed/grat-v2.png" },
  { name: "Samāgata Foundation", logo: "/collab/trimmed/samagata-v2.png" },
  { name: "Crafty", logo: "/collab/trimmed/crafty.png" },
  { name: "Gubbachi Learning Community", logo: "/collab/trimmed/gubbacchi.png" },
  { name: "Brainy Stars", logo: "/collab/trimmed/brainystars-v2.png" },
  { name: "iGenius", logo: "/collab/trimmed/igenius-v2.png" },
  { name: "10Labs", logo: "/collab/trimmed/onezerolabs-v2.png" },
];

const accents = ["#7C3AED", "#00CDBA", "#FF5C7A", "#268bff"];

function PartnerTile({ partner, index }: { partner: Partner; index: number }) {
  const accent = accents[index % accents.length];

  return (
    <li className="shrink-0 px-2.5 sm:px-3">
      {/* No card behind the logo — the marks sit straight on the band, so the
          white backgrounds baked into several of the source files have been
          knocked out to transparent. */}
      <div className="group h-32 w-60 sm:w-64 px-7 flex items-center justify-center transition-transform duration-300 hover:-translate-y-0.5">
        {partner.logo ? (
          /* Every logo gets the same fixed box and object-contain letterboxes
             inside it, so each one grows to fill whichever axis it runs out of
             first. A max-height alone is only a ceiling — small source files
             like iGenius (67x92) would sit at their own size and read tiny. */
          <Image
            src={partner.logo}
            alt={partner.name}
            width={280}
            height={140}
            sizes="256px"
            className="h-24 w-full object-contain rounded-lg transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white text-xs font-bold tracking-tight"
              style={{ backgroundColor: accent }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-semibold text-gray-400 tracking-tight whitespace-nowrap">
              {partner.name}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

export default function PartnersSection() {
  // Duplicated once so the -50% translate in `animate-marquee` loops seamlessly.
  const loop = [...partners, ...partners];

  return (
    <section className="relative w-full bg-[#F7EAC6] pt-16 pb-20 lg:pt-20 lg:pb-28 overflow-hidden z-10">
      <div className="w-full max-w-[1100px] mx-auto px-6 md:px-12 mb-10 lg:mb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="flex flex-wrap items-center justify-center gap-3 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-headline text-[#111827] mb-5">
            <span>Our</span>
            {/* Violet rather than the coral used by Our Impact directly above,
                so the two pills read as siblings instead of a repeat. */}
            <span className="inline-block bg-[#7C3AED] text-white px-4 py-1.5 sm:px-6 sm:py-2 rounded-2xl -rotate-2 tracking-wide">
              Collaborations
            </span>
          </h2>
          <p
            className="text-gray-500 font-medium max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-poppins), sans-serif" }}
          >
            Together, we bring social-emotional skills to life through stories,
            arts, movement, play and more.
          </p>
        </motion.div>
      </div>

      {/* Marquee. Hidden from assistive tech because the list is duplicated for
          the loop; the real names are exposed in the sr-only list below. */}
      <div
        aria-hidden="true"
        className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]"
      >
        <ul className="flex w-max animate-marquee">
          {loop.map((partner, i) => (
            <PartnerTile
              key={i}
              partner={partner}
              index={i % partners.length}
            />
          ))}
        </ul>
      </div>

      <ul className="sr-only">
        {partners.map((partner) => (
          <li key={partner.name}>{partner.name}</li>
        ))}
      </ul>

      {/* Curves back out into the CTA's lighter cream. */}
      <WaveDivider color="#FFF9E6" />
    </section>
  );
}
