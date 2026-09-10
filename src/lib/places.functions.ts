import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

export type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  reviewUrl: string;
};

const searchSchema = z.object({
  query: z.string().trim().min(3).max(120),
});

/** Busca o negócio pelo nome no Google (Places API New), sempre pelo servidor. */
export const searchBusinesses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`places:${data.query.slice(0, 40)}`, 20, 60_000)) {
      return { ok: false as const, error: "Muitas buscas seguidas. Aguarde alguns segundos." };
    }

    const key = process.env["GOOGLE_MAPS_API_KEY"];
    if (!key) {
      return { ok: false as const, error: "A busca no Google não está disponível agora." };
    }

    const response = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: data.query,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 8,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Places searchText falhou [${response.status}]: ${body}`);
      return {
        ok: false as const,
        error: "Não conseguimos consultar o Google agora. Tente de novo em instantes.",
      };
    }

    const json = (await response.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
      }[];
    };

    const results: BusinessResult[] = (json.places ?? []).map((place) => ({
      placeId: place.id,
      name: place.displayName?.text ?? "Negócio sem nome",
      address: place.formattedAddress ?? "",
      rating: place.rating ?? null,
      reviews: place.userRatingCount ?? null,
      reviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.id)}`,
    }));

    return { ok: true as const, results };
  });
