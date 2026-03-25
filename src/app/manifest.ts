import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sage",
    short_name: "Sage",
    description: "Your personal second brain — tasks, knowledge, and time, unified.",
    start_url: "/inbox",
    scope: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#C96444",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
