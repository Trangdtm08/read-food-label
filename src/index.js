const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SYSTEM_PROMPT = `Bạn là trợ lý giáo dục giúp học sinh THCS đọc hiểu nhãn thực phẩm.
Phân tích hình ảnh bảng thành phần và dinh dưỡng một cách thận trọng, dễ hiểu, không chẩn đoán bệnh.
Chỉ đưa ra nhận xét dựa trên thông tin nhìn thấy; nếu ảnh mờ hoặc thiếu dữ liệu, hãy nói rõ.
Không gắn nhãn một phụ gia là nguy hiểm chỉ vì tên của nó. Giải thích ngắn gọn vai trò của phụ gia nếu nhận diện được.
Ưu tiên giải thích khái niệm, so sánh với khẩu phần ghi trên nhãn, và gợi ý cách chọn thực phẩm cân bằng.
Kết quả phải là JSON hợp lệ, không markdown, theo đúng cấu trúc được yêu cầu.`;

const USER_PROMPT = `Hãy đọc ảnh nhãn thực phẩm này và trả về JSON theo cấu trúc:
{
  "product_name": "Tên sản phẩm hoặc Chưa rõ",
  "confidence": 0,
  "summary": "Một câu kết luận dễ hiểu cho học sinh",
  "level": "Thỉnh thoảng | Có thể dùng vừa phải | Lựa chọn khá ổn | Chưa đủ dữ liệu",
  "energy": { "value": "giá trị nhìn thấy hoặc Chưa rõ", "note": "giải thích ngắn" },
  "nutrients": [
    { "name": "Tên chất", "value": "giá trị", "status": "high | medium | low | unknown", "explanation": "giải thích dễ hiểu" }
  ],
  "ingredients": [
    { "name": "Thành phần hoặc phụ gia", "role": "vai trò thường gặp", "note": "ghi chú trung tính" }
  ],
  "positives": ["Điểm tích cực nhìn thấy"],
  "watchouts": ["Điểm cần chú ý"],
  "tips": ["Gợi ý lựa chọn hoặc sử dụng"],
  "student_question": "Một câu hỏi gợi mở để học sinh tự suy nghĩ",
  "disclaimer": "Thông tin giáo dục, không thay thế tư vấn y tế."
}
Quy tắc:
- confidence là số từ 0 đến 100.
- Tối đa 6 nutrients, 8 ingredients, 4 items cho mỗi mảng positives/watchouts/tips.
- Nếu không đọc được nhãn, trả về level là "Chưa đủ dữ liệu" và nêu rõ phần cần chụp lại.
- Phân biệt “mỗi khẩu phần” với “100 g/100 ml” nếu nhãn có ghi.
- Không tự bịa số liệu.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return analyze(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function analyze(request, env) {
  try {
    const apiKey = env.LLM_API_KEY;
    const apiUrl = env.LLM_API_URL;
    if (!apiKey || !apiUrl) {
      return json({ error: "Missing LLM_API_KEY or LLM_API_URL. Configure them as Cloudflare secrets/variables." }, 500);
    }

    const form = await request.formData();
    const image = form.get("image");
    if (!image || typeof image.arrayBuffer !== "function") {
      return json({ error: "Please upload an image of a food label." }, 400);
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return json({ error: "Only JPG, PNG, or WebP images are supported." }, 400);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return json({ error: "Image must be 10 MB or smaller." }, 400);
    }

    const base64 = arrayBufferToBase64(await image.arrayBuffer());
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: providerHeaders(env),
      body: JSON.stringify({
        model: env.LLM_MODEL || "your-model",
        max_tokens: Number(env.LLM_MAX_TOKENS || 3600),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: `data:${image.type};base64,${base64}` } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("LLM provider error", response.status, details);
      return json({ error: "The AI service could not analyze this image right now." }, 502);
    }

    const payload = await response.json();
    const text = extractProviderText(payload);
    return json(normalizeResult(parseJson(text)));
  } catch (error) {
    console.error(error);
    return json({ error: "Something went wrong while analyzing the label." }, 500);
  }
}

function providerHeaders(env) {
  const headers = { "content-type": "application/json" };
  const key = env.LLM_API_KEY;
  const header = env.LLM_API_KEY_HEADER || "authorization";
  const prefix = env.LLM_API_KEY_PREFIX ?? "Bearer ";
  if (key) headers[header] = `${prefix}${key}`;
  if (env.LLM_EXTRA_HEADERS) {
    try { Object.assign(headers, JSON.parse(env.LLM_EXTRA_HEADERS)); } catch (_) {
      console.error("LLM_EXTRA_HEADERS must be valid JSON");
    }
  }
  return headers;
}

function extractProviderText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item?.text || "").join("\n");
  if (typeof payload?.output_text === "string") return payload.output_text;
  if (typeof payload?.text === "string") return payload.text;
  if (typeof payload?.content === "string") return payload.content;
  if (Array.isArray(payload?.content)) return payload.content.map((item) => item?.text || "").join("\n");
  return "";
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }
    return { summary: text || "No readable result was returned." };
  }
}

function normalizeResult(value) {
  const result = value && typeof value === "object" ? value : {};
  const list = (key, limit) => Array.isArray(result[key]) ? result[key].slice(0, limit) : [];
  return {
    product_name: String(result.product_name || "Sản phẩm chưa rõ"),
    confidence: clamp(Number(result.confidence) || 0, 0, 100),
    summary: String(result.summary || "Chưa đủ dữ liệu để đưa ra kết luận."),
    level: String(result.level || "Chưa đủ dữ liệu"),
    energy: result.energy && typeof result.energy === "object" ? {
      value: String(result.energy.value || "Chưa rõ"),
      note: String(result.energy.note || "")
    } : { value: "Chưa rõ", note: "" },
    nutrients: list("nutrients", 6).map((item) => ({
      name: String(item?.name || "Chất dinh dưỡng"), value: String(item?.value || "Chưa rõ"),
      status: ["high", "medium", "low", "unknown"].includes(item?.status) ? item.status : "unknown",
      explanation: String(item?.explanation || "")
    })),
    ingredients: list("ingredients", 8).map((item) => ({
      name: String(item?.name || "Thành phần"), role: String(item?.role || ""), note: String(item?.note || "")
    })),
    positives: list("positives", 4).map(String),
    watchouts: list("watchouts", 4).map(String),
    tips: list("tips", 4).map(String),
    student_question: String(result.student_question || "Em sẽ kiểm tra thông tin nào trước khi chọn sản phẩm?"),
    disclaimer: String(result.disclaimer || "Thông tin giáo dục, không thay thế tư vấn y tế.")
  };
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } }));
}
function cors(response) {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("access-control-allow-methods", "POST, OPTIONS");
  response.headers.set("access-control-allow-headers", "content-type");
  return response;
}
