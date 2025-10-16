import { supabase } from "@/utils/supabase";

export type Banner = {
  id: number;
  image: string;
  title?: string;
  subtitle?: string;
  link_type?: string;
  link_target?: string;
};

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase.rpc("rpc_list_banners");
  if (error) throw error;
  return (data || []).map((b: any) => ({
    id: Number(b.id),
    image: b.image,
    title: b.title || "",
    subtitle: b.subtitle || "",
    link_type: b.link_type || "none",
    link_target: b.link_target || "",
  }));
}


