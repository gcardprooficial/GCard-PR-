import { getPlateProductsServer } from "@/lib/plate/catalogServer";

// Catálogo público de produtos. A landing usa direto o server helper;
// esta rota serve o wizard/telas client. Só produtos ativos.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };

export async function GET() {
  const products = await getPlateProductsServer();
  return Response.json({ products }, { headers: CACHE_HEADERS });
}
