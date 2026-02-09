import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    // ✅ SERVICE_ROLE for server-side Edge Function
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const queueItem = body.queue_item as {
      id: string;
      type:
        | "VISION_LOG"
        | "PANTRY_VERIFY"
        | "GENERIC_MUTATION"
        | "SHOPPING_MUTATION"
        | "PANTRY_ITEM_MUTATION";
      user_id: string;
      client_updated_at_ms: number;
    };

    if (queueItem.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    function shouldApplyClientMutation(params: {
      server_updated_at_ms: number | null;
      client_updated_at_ms: number;
    }) {
      if (params.server_updated_at_ms == null) return true;
      return params.client_updated_at_ms >= params.server_updated_at_ms;
    }

    if (queueItem.type === "PANTRY_VERIFY") {
      const payload = body.payload as {
        pantry_id: number;
        status: "active" | "consumed";
        client_updated_at_ms: number;
      };

      const { data: current, error: curErr } = await supabase
        .from("pantry")
        .select("id, last_verified_at")
        .eq("id", payload.pantry_id)
        .single();

      if (curErr || !current) {
        return new Response(JSON.stringify({ error: "pantry_not_found" }), {
          status: 404,
        });
      }

      const serverMs = current.last_verified_at
        ? new Date(current.last_verified_at as string).getTime()
        : null;

      const ok = shouldApplyClientMutation({
        server_updated_at_ms: serverMs,
        client_updated_at_ms: payload.client_updated_at_ms ??
          queueItem.client_updated_at_ms,
      });

      if (!ok) {
        return new Response(
          JSON.stringify({
            error: "conflict_server_newer",
            server_ts: serverMs,
          }),
          { status: 409 },
        );
      }

      const { error: updErr } = await supabase
        .from("pantry")
        .update({
          status: payload.status,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", payload.pantry_id);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (queueItem.type === "SHOPPING_MUTATION") {
      const payload = body.payload as {
        action: "UPSERT" | "DELETE";
        item: any;
        client_ts: number;
      };

      if (payload.action === "DELETE" && payload.item.id) {
        const { error } = await supabase.from("shopping_list").delete().eq(
          "id",
          payload.item.id,
        );
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
          });
        }
      } else if (payload.action === "UPSERT") {
        const { id, temp_id, ...data } = payload.item;

        if (id) {
          // Update existing
          const { error } = await supabase.from("shopping_list").update(data)
            .eq("id", id);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
            });
          }
        } else {
          // Insert new
          // Constraint: user might be offline when creating multiple items.
          // We rely on the queue order.
          const { error } = await supabase.from("shopping_list").insert(data);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (queueItem.type === "VISION_LOG") {
      const payload = body.payload as {
        grams: number;
        metabolic_tags_json: any;
        captured_at: string;
      };

      const clientLogId = payload.metabolic_tags_json?.client_log_id;

      // Idempotency Check
      if (clientLogId) {
        // We use a containment query for JSONB: metabolic_tags_json @> {"client_log_id": "..."}
        const { data: existing, error: existErr } = await supabase
          .from("logs")
          .select("id")
          .eq("user_id", user.id)
          .contains("metabolic_tags_json", { client_log_id: clientLogId })
          .maybeSingle(); // maybeSingle avoids error if 0 found

        if (existing) {
          console.log(`Skipping duplicate log ${clientLogId}`);
          return new Response(
            JSON.stringify({ success: true, note: "duplicate_skipped" }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      }

      const { error: insertErr } = await supabase.from("logs").insert({
        user_id: user.id,
        grams: payload.grams,
        metabolic_tags_json: payload.metabolic_tags_json,
        captured_at: payload.captured_at || new Date().toISOString(),
      });

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (queueItem.type === "PANTRY_ITEM_MUTATION") {
      const payload = body.payload as {
        action: "UPSERT" | "DELETE";
        item: any;
        client_ts: number;
      };

      if (payload.action === "DELETE" && payload.item.id) {
        const { error } = await supabase.from("pantry").delete().eq(
          "id",
          payload.item.id,
        );
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
          });
        }
      } else if (payload.action === "UPSERT") {
        const { id, temp_id, ...data } = payload.item;
        if (id) {
          const { error } = await supabase.from("pantry").update(data).eq(
            "id",
            id,
          );
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
            });
          }
        } else {
          const { error } = await supabase.from("pantry").insert({
            ...data,
            status: "active",
            probability_score: 1.0,
            created_at: new Date().toISOString(),
          });
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
            });
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_mutation_type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-apply error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
