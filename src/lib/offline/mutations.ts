import { enqueueMutation } from "./queue";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

/**
 * Tries to insert a log entry.
 * If offline or network fails, queues it for later.
 */
export async function mutateLog(payload: {
    grams: number;
    metabolic_tags_json: any;
    captured_at?: string;
    user_id: string;
}) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    const client_log_id = crypto.randomUUID();

    // Inject ID for idempotency
    const enrichedPayload = {
        ...payload,
        metabolic_tags_json: {
            ...payload.metabolic_tags_json,
            client_log_id,
        },
    };

    if (isOnline) {
        try {
            const { error } = await supabase.from("logs").insert({
                user_id: enrichedPayload.user_id,
                grams: enrichedPayload.grams,
                metabolic_tags_json: enrichedPayload.metabolic_tags_json,
                captured_at: enrichedPayload.captured_at ||
                    new Date().toISOString(),
            });

            if (error) throw error;
            return { success: true, source: "online" };
        } catch (err: any) {
            console.warn("Online mutation failed, falling back to queue:", err);
            // Fallthrough to queue
        }
    }

    // Offline or Fallback
    const id = crypto.randomUUID(); // Queue Item ID
    await enqueueMutation({
        id,
        type: "VISION_LOG",
        user_id: payload.user_id,
        payload: enrichedPayload,
    });

    return { success: true, source: "queue" };
}

/**
 * Tries to verify a pantry item.
 */
export async function mutatePantryVerify(payload: {
    pantry_id: number;
    status: "active" | "consumed";
    user_id: string;
}) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;
    const now = new Date().toISOString();

    if (isOnline) {
        try {
            const { error } = await supabase
                .from("pantry")
                .update({
                    status: payload.status,
                    last_verified_at: now,
                })
                .eq("id", payload.pantry_id);

            if (error) throw error;
            return { success: true, source: "online" };
        } catch (err: any) {
            console.warn("Online mutation failed, falling back to queue:", err);
        }
    }

    const id = crypto.randomUUID();
    await enqueueMutation({
        id,
        type: "PANTRY_VERIFY",
        user_id: payload.user_id,
        client_updated_at_ms: Date.now(),
        payload: {
            pantry_id: payload.pantry_id,
            status: payload.status,
            client_updated_at_ms: Date.now(),
        },
    });

    return { success: true, source: "queue" };
}

/**
 * Tries to modify shopping list (Upsert or Delete).
 */
export async function mutateShopping(payload: {
    action: "UPSERT" | "DELETE";
    item: {
        id?: number; // DB ID if known (for delete/update)
        name?: string;
        category?: string;
        is_checked?: boolean;
        temp_id?: string; // For optimistic UI correlation
        household_id?: string;
        added_by?: string;
    };
    user_id: string;
}) {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;

    if (isOnline) {
        try {
            if (payload.action === "DELETE" && payload.item.id) {
                await supabase.from("shopping_list").delete().eq(
                    "id",
                    payload.item.id,
                );
            } else if (payload.action === "UPSERT") {
                const { id, temp_id, ...data } = payload.item;

                if (id) {
                    await supabase.from("shopping_list").update(data).eq(
                        "id",
                        id,
                    );
                } else {
                    // Clean up temp_id before sending to DB if needed, or allow it.
                    const { ...insertData } = data as any;
                    await supabase.from("shopping_list").insert(insertData);
                }
            }
            return { success: true, source: "online" };
        } catch (err: any) {
            console.warn("Online shopping mutation failed, queueing:", err);
        }
    }

    const id = crypto.randomUUID();
    await enqueueMutation({
        id,
        type: "SHOPPING_MUTATION",
        user_id: payload.user_id,
        client_updated_at_ms: Date.now(),
        payload: {
            ...payload,
            client_ts: Date.now(),
        },
    });

    return { success: true, source: "queue" };
}
