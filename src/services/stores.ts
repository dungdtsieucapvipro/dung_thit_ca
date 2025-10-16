import { supabase } from "@/utils/supabase";

export type Store = {
  id: number;
  name: string;
  image?: string;
  address: string;
  phone?: string;
  opening_hours?: string;
  location?: { lat: number; lng: number };
};

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.rpc("rpc_list_stores");
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: Number(s.id),
    name: s.name,
    image: s.image || "",
    address: s.address,
    phone: s.phone || "",
    opening_hours: s.opening_hours || "",
    location: s.location || undefined,
  }));
}


