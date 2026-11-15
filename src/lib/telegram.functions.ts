import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyInitData } from "./telegram-verify";

type LinkResult = { ok: true } | { ok: false; code: string };

export const linkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ initData: z.string().min(1).max(4096) }).parse(input))
  .handler(async ({ data, context }): Promise<LinkResult> => {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
    const v = await verifyInitData(data.initData, token);
    if (!v.ok) return { ok: false, code: v.code };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from("profiles").select("user_id").eq("telegram_id", v.telegramId).maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (owner && owner.user_id !== userId) return { ok: false, code: "TELEGRAM_IN_USE" };
    if (owner) return { ok: true };

    const { data: me, error: meError } = await supabaseAdmin
      .from("profiles").select("telegram_id,telegram_relink_allowed").eq("user_id", userId).single();
    if (meError || !me) throw new Error('PROFILE_NOT_FOUND');
    const relinking = me.telegram_id !== null && me.telegram_id !== v.telegramId;
    if (relinking && !me.telegram_relink_allowed) {
      return { ok: false, code: "ACCOUNT_HAS_OTHER_TELEGRAM" };
    }
    let operation = supabaseAdmin
      .from("profiles").update({ telegram_id: v.telegramId, telegram_relink_allowed: false }).eq("user_id", userId);
    operation = relinking ? operation.eq("telegram_relink_allowed", true) : operation.is("telegram_id", null);
    const { data: updated, error } = await operation.select('telegram_id').maybeSingle();
    if (error) {
      if (error.code === "23505") return { ok: false, code: "TELEGRAM_IN_USE" };
      throw new Error(error.message);
    }
    if (!updated) return { ok: false, code: 'ACCOUNT_HAS_OTHER_TELEGRAM' };
    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId, action: relinking ? "telegram_relinked" : "telegram_linked", target_table: "profiles", target_id: userId,
      details: { telegram_id: v.telegramId, authorization_consumed: relinking },
    });
    return { ok: true };
  });
