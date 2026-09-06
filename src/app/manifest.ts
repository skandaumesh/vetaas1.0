import type { MetadataRoute } from "next";

/**
 * Web app manifest for the public site. The admin panel links its own
 * manifest (public/admin.webmanifest) from the admin layout, so installing
 * from an admin screen gives Kirti an app that opens straight into the
 * dashboard rather than the marketing home page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vetaas Education Foundation",
    short_name: "Vetaas",
    description:
      "Social Emotional Learning for children, parents and educators in Bengaluru.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#7C3AED",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Events", url: "/events" },
      { name: "Membership", url: "/membership" },
      { name: "Contact", url: "/contact" },
    ],
  };
}
