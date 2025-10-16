import { supabase } from "@/utils/supabase";
import { Category, Product } from "@/types";

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.rpc("rpc_list_categories");
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: Number(c.id),
    name: c.name,
    image: c.image || "",
  }));
}

export async function fetchProducts(params?: {
  categoryId?: number;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<(Product & { categoryId: number })[]> {
  const { data, error } = await supabase.rpc("rpc_list_products", {
    p_category_id: params?.categoryId ?? null,
    p_search: params?.search ?? null,
    p_offset: params?.offset ?? 0,
    p_limit: params?.limit ?? 100,
  });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: Number(p.id),
    name: p.name,
    price: Number(p.price ?? 0),
    originalPrice: p.original_price ? Number(p.original_price) : undefined,
    image: p.image || "",
    detail: p.detail || "",
    sizes: p.sizes || undefined,
    colors: p.colors || undefined,
    categoryId: Number(p.category_id),
    category: { id: Number(p.category_id), name: "", image: "" },
  }));
}

export async function fetchFlashProducts(): Promise<(Product & { categoryId: number })[]> {
  const { data, error } = await supabase.rpc("rpc_list_flash_products", { p_limit: 100 });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: Number(p.id),
    name: p.name,
    price: Number(p.price ?? 0),
    originalPrice: p.original_price ? Number(p.original_price) : undefined,
    image: p.image || "",
    detail: p.detail || "",
    sizes: p.sizes || undefined,
    colors: p.colors || undefined,
    categoryId: Number(p.category_id),
    category: { id: Number(p.category_id), name: "", image: "" },
  }));
}

export async function upsertCategory(payload: { id?: number; name: string; image?: string }) {
  const { data, error } = await supabase.rpc("rpc_upsert_category", {
    p_name: payload.name,
    p_image: payload.image ?? null,
    p_id: payload.id ?? null,
  });
  if (error) throw error;
  return data;
}

export async function upsertProduct(payload: {
  id?: number;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  categoryId: number;
  detail?: string;
  sizes?: any;
  colors?: any;
  isFlashSale?: boolean;
}) {
  const { data, error } = await supabase.rpc("rpc_upsert_product", {
    p_name: payload.name,
    p_price: payload.price,
    p_category_id: payload.categoryId,
    p_original_price: payload.originalPrice ?? null,
    p_image: payload.image ?? null,
    p_detail: payload.detail ?? null,
    p_sizes: payload.sizes ?? null,
    p_colors: payload.colors ?? null,
    p_is_flash_sale: payload.isFlashSale ?? null,
    p_id: payload.id ?? null,
  });
  if (error) throw error;
  return data;
}


