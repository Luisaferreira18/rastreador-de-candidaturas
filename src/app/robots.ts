import type { MetadataRoute } from "next";

/** Só a página inicial e as de entrada interessam aos buscadores: o resto pede login. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
