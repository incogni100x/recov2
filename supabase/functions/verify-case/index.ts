import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "support@pythoncyberhacks.com";
const fromEmail = Deno.env.get("MAIL_FROM") ?? "PythonCyberHacks <support@pythoncyberhacks.com>";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendEmail(payload: Record<string, unknown>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = String(body?.action ?? "");
    const caseId = String(body?.caseId ?? "").trim();
    if (!caseId) return jsonResponse({ error: "caseId is required" }, 400);

    const { data: submission, error: fetchError } = await supabase
      .from("case_submissions")
      .select("*")
      .eq("case_id", caseId)
      .single();

    if (fetchError || !submission) return jsonResponse({ error: "Case not found" }, 404);

    if (action === "lookup") {
      return jsonResponse({
        success: true,
        case: {
          case_id: submission.case_id,
          first_name: submission.first_name,
          last_name: submission.last_name,
          email: submission.email,
          phone: submission.phone,
          city: submission.city,
          country: submission.country,
          loss_range: submission.loss_range,
          case_description: submission.case_description,
        },
      });
    }

    if (action !== "submit_proof") {
      return jsonResponse({ error: "Unsupported action" }, 400);
    }

    const proofNotes = String(body?.proofNotes ?? "").trim();
    if (!proofNotes) return jsonResponse({ error: "proofNotes is required" }, 400);

    const files = Array.isArray(body?.files) ? body.files : [];
    const safeFiles = files.slice(0, 3).map((file: Record<string, unknown>) => ({
      name: String(file?.name ?? "attachment.bin"),
      type: String(file?.type ?? "application/octet-stream"),
      size: Number(file?.size ?? 0),
      content: String(file?.content ?? ""),
    }));

    const filesForDb = safeFiles.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    const { error: insertProofError } = await supabase.from("case_proofs").insert({
      case_submission_id: submission.id,
      proof_notes: proofNotes,
      files: filesForDb,
    });
    if (insertProofError) throw insertProofError;

    const userHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
        <p>Hello ${submission.first_name},</p>
        <p>We received your additional verification proofs for case <strong>${submission.case_id}</strong>.</p>
        <p>Our team will review your submission and contact you with next steps.</p>
        <p>Regards,<br/>PythonCyberHacks Support</p>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
        <h3 style="margin:0 0 12px;">Proof Submission Received: ${submission.case_id}</h3>
        <p><strong>Name:</strong> ${submission.first_name} ${submission.last_name}</p>
        <p><strong>Email:</strong> ${submission.email}</p>
        <p><strong>Proof Notes:</strong><br/>${proofNotes.replaceAll("\n", "<br/>")}</p>
        <p><strong>Files:</strong> ${filesForDb.length ? filesForDb.map((f) => f.name).join(", ") : "None uploaded"}</p>
      </div>
    `;

    await sendEmail({
      from: fromEmail,
      to: [submission.email],
      subject: `Proof Received - ${submission.case_id}`,
      html: userHtml,
    });

    await sendEmail({
      from: fromEmail,
      to: [adminEmail],
      subject: `Verification Proof Submitted - ${submission.case_id}`,
      html: adminHtml,
      attachments: safeFiles
        .filter((file) => file.content)
        .map((file) => ({
          filename: file.name,
          content: file.content,
          type: file.type,
        })),
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
