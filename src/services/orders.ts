import { supabase } from "@/utils/supabase";
import { getZaloUserId } from "@/services/zalo-auth-simple";
import { Delivery, Order, CartItem } from "@/types";

type CreateOrderItem = { product_id: number; quantity: number };

function mapToOrder(row: any): Order {
  const delivery: Delivery =
    row.delivery_type === "shipping"
      ? ({ type: "shipping", ...(row.shipping_address ?? {}) } as any)
      : ({ type: "pickup", stationId: Number(row.station_id) } as any);

  return {
    id: Number(row.id),
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: new Date(row.created_at),
    receivedAt: new Date(row.updated_at),
    items: [],
    delivery,
    total: Number(row.total ?? 0),
    note: row.note ?? "",
  };
}

export async function createOrderOnDB(params: {
  items: CreateOrderItem[];
  delivery: { type: "shipping"; address: any } | { type: "pickup"; stationId: number };
  note?: string;
}) {
  const userId = await getZaloUserId();
  const { data, error } = await supabase.rpc("rpc_create_order", {
    p_user_id: userId,
    p_items: params.items,
    p_delivery_type: params.delivery.type,
    p_shipping_address: params.delivery.type === "shipping" ? params.delivery.address : null,
    p_station_id: params.delivery.type === "pickup" ? params.delivery.stationId : null,
    p_note: params.note ?? null,
  });
  if (error) throw error;
  return mapToOrder(data);
}

export async function listOrdersOnDB(status?: string): Promise<Order[]> {
  const userId = await getZaloUserId();
  const { data, error } = await supabase.rpc("rpc_list_orders", {
    p_user_id: userId,
    p_status: status ?? null,
  });
  if (error) throw error;
  return (data || []).map(mapToOrder);
}

export async function getOrderItemsOnDB(orderId: number): Promise<CartItem[]> {
  const userId = await getZaloUserId();
  const { data, error } = await supabase.rpc("rpc_list_order_items", {
    p_user_id: userId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    product: {
      id: Number(r.product_id),
      name: r.name,
      price: Number(r.price ?? 0),
      image: r.image || "",
      category: { id: 0, name: "", image: "" },
    },
    quantity: Number(r.quantity),
  }));
}


