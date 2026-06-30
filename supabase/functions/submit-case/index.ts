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
const siteUrl = Deno.env.get("SITE_URL") ?? "https://pythoncyberhacks.com";
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

function generateCaseId() {
  const year = new Date().getFullYear();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PCH-${year}-${random}`;
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
    const required = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "age",
      "city",
      "country",
      "caseDescription",
      "lossRange",
    ];
    for (const field of required) {
      if (!body?.[field] || String(body[field]).trim() === "") {
        return jsonResponse({ error: `Missing required field: ${field}` }, 400);
      }
    }

    const age = Number(String(body.age).trim());
    if (!Number.isInteger(age) || age < 18 || age > 120) {
      return jsonResponse({ error: "Age must be between 18 and 120" }, 400);
    }

    const caseId = generateCaseId();
    const insertPayload = {
      case_id: caseId,
      first_name: String(body.firstName).trim(),
      last_name: String(body.lastName).trim(),
      email: String(body.email).trim().toLowerCase(),
      phone: String(body.phone).trim(),
      age,
      city: String(body.city).trim(),
      country: String(body.country).trim(),
      case_description: String(body.caseDescription).trim(),
      loss_range: String(body.lossRange).trim(),
    };

    const { error: insertError } = await supabase.from("case_submissions").insert(insertPayload);
    if (insertError) throw insertError;

    const verificationLink = `${siteUrl}/verification.html`;
    const userHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
        <p>Hello ${insertPayload.first_name},</p>
        <p>Your case has been received. Your case ID is <strong>${caseId}</strong>.</p>
        <p>Please keep this ID safe and continue verification here:</p>
        <p><a href="${verificationLink}" style="color:#245ACA;">${verificationLink}</a></p>
        <p>Thank you,<br/>PythonCyberHacks Support</p>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
        <h3 style="margin:0 0 12px;">New Case Submission: ${caseId}</h3>
        <p><strong>Name:</strong> ${insertPayload.first_name} ${insertPayload.last_name}</p>
        <p><strong>Email:</strong> ${insertPayload.email}</p>
        <p><strong>Phone:</strong> ${insertPayload.phone}</p>
        <p><strong>Age:</strong> ${insertPayload.age}</p>
        <p><strong>City/Country:</strong> ${insertPayload.city}, ${insertPayload.country}</p>
        <p><strong>Estimated Loss:</strong> ${insertPayload.loss_range}</p>
        <p><strong>Case Description:</strong><br/>${insertPayload.case_description.replaceAll("\n", "<br/>")}</p>
      </div>
    `;

    await sendEmail({
      from: fromEmail,
      to: [insertPayload.email],
      subject: `Your Case ID: ${caseId}`,
      html: userHtml,
    });

    await sendEmail({
      from: fromEmail,
      to: [adminEmail],
      subject: `New Case Submission - ${caseId}`,
      html: adminHtml,
    });

    return jsonResponse({ success: true, caseId });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
