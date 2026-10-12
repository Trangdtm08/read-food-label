const $ = (selector) => document.querySelector(selector);
const fileInput = $("#fileInput");
const uploadCard = $("#uploadCard");
const uploadEmpty = $("#uploadEmpty");
const uploadPreview = $("#uploadPreview");
const previewImage = $("#previewImage");
const errorBox = $("#errorBox");
let selectedFile = null;

$("#chooseButton").addEventListener("click", () => fileInput.click());
$("#changeButton").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => fileInput.files[0] && setFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((event) => uploadCard.addEventListener(event, (e) => { e.preventDefault(); uploadCard.classList.add("dragging"); }));
["dragleave", "drop"].forEach((event) => uploadCard.addEventListener(event, (e) => { e.preventDefault(); uploadCard.classList.remove("dragging"); }));
uploadCard.addEventListener("drop", (e) => { const file = e.dataTransfer.files[0]; if (file) setFile(file); });
$("#dismissError").addEventListener("click", () => errorBox.classList.add("hidden"));
$("#newScanButton").addEventListener("click", () => { $("#resultSection").classList.add("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); });

function setFile(file) {
  if (!file.type.startsWith("image/")) return showError("Hãy chọn một tệp hình ảnh JPG, PNG hoặc WebP.");
  if (file.size > 10 * 1024 * 1024) return showError("Ảnh cần nhỏ hơn 10 MB.");
  selectedFile = file;
  previewImage.src = URL.createObjectURL(file);
  uploadEmpty.classList.add("hidden"); uploadPreview.classList.remove("hidden"); errorBox.classList.add("hidden");
  analyze(file);
}

async function analyze(file) {
  $("#loadingOverlay").classList.remove("hidden");
  $("#resultSection").classList.add("hidden");
  const form = new FormData(); form.append("image", file);
  try {
    const response = await fetch("/api/analyze", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể phân tích ảnh.");
    renderResult(result);
    $("#resultSection").classList.remove("hidden");
    setTimeout(() => $("#resultSection").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  } catch (error) { showError(error.message); }
  finally { $("#loadingOverlay").classList.add("hidden"); }
}

function renderResult(data) {
  $("#productName").textContent = data.product_name;
  $("#confidenceValue").textContent = `${data.confidence}%`;
  $("#confidenceRing").style.setProperty("--score", `${data.confidence}%`);
  $("#levelTag").textContent = data.level;
  $("#summaryText").textContent = data.summary;
  $("#energyValue").textContent = data.energy?.value || "Chưa rõ";
  $("#energyNote").textContent = data.energy?.note || "";
  fillList("#positivesList", data.positives, "Chưa thấy điểm nổi bật rõ ràng trong ảnh.");
  fillList("#watchoutsList", data.watchouts, "Chưa đủ dữ liệu để xác định điều cần chú ý.");
  $("#nutrientList").innerHTML = (data.nutrients || []).map((item) => `<div class="nutrient"><strong>${esc(item.name)}</strong><span class="nutrient-value">${esc(item.value)}</span><small><span class="status ${esc(item.status)}">${statusLabel(item.status)}</span> · ${esc(item.explanation)}</small></div>`).join("") || emptyMessage("Chưa đọc được bảng dinh dưỡng.");
  $("#ingredientList").innerHTML = (data.ingredients || []).map((item) => `<div class="ingredient"><strong>${esc(item.name)}</strong><span>${esc(item.role)}${item.note ? ` · ${esc(item.note)}` : ""}</span></div>`).join("") || emptyMessage("Chưa đọc được danh sách thành phần.");
  fillList("#tipsList", data.tips, "Hãy chụp lại ảnh rõ hơn để nhận gợi ý.");
  $("#studentQuestion").textContent = data.student_question;
  $("#disclaimer").textContent = data.disclaimer;
}
function fillList(selector, items, fallback) { $(selector).innerHTML = (items?.length ? items : [fallback]).map((item) => `<li>${esc(item)}</li>`).join(""); }
function emptyMessage(text) { return `<p style="color:#78857b;font-size:13px">${esc(text)}</p>`; }
function statusLabel(status) { return ({ high: "cao", medium: "vừa", low: "thấp", unknown: "chưa rõ" })[status] || "chưa rõ"; }
function esc(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }
function showError(message) { $("#errorText").textContent = message; errorBox.classList.remove("hidden"); }
