(function () {
  const cfg = window.APP_CONFIG;
  const lookupForm = document.getElementById("lookupForm");
  const proofForm = document.getElementById("proofForm");
  const caseDetails = document.getElementById("caseDetails");
  const caseSummary = document.getElementById("caseSummary");
  const lookupStatus = document.getElementById("lookupStatus");
  const proofStatus = document.getElementById("proofStatus");
  const caseIdInput = document.getElementById("caseId");
  const lookupSubmitButton = document.getElementById("lookupSubmitButton");
  const proofSubmitButton = document.getElementById("proofSubmitButton");
  const proofFilesInput = document.getElementById("proofFiles");
  const proofFilesCount = document.getElementById("proofFilesCount");
  const proofFilesList = document.getElementById("proofFilesList");
  let selectedProofFiles = [];
  let loadedCaseId = "";

  if (!cfg || !lookupForm || !proofForm) return;

  const endpoint = `${cfg.supabaseUrl}/functions/v1/verify-case`;

  function setText(node, msg, state = "info") {
    const icon = state === "error"
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"></circle><path d="M12 7v6M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>'
      : state === "success"
        ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"></circle><path d="M8 12.5l2.5 2.5L16.5 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"></circle><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    const typeClass = state;
    node.innerHTML = msg ? `<span class="status ${typeClass}">${icon}<span>${msg}</span></span>` : "";
  }

  function setButtonLoading(button, isLoading, loadingLabel, defaultLabel) {
    if (!button) return;
    const label = button.querySelector(".button-label");
    button.disabled = isLoading;
    button.dataset.loading = String(isLoading);
    button.setAttribute("aria-busy", String(isLoading));
    if (label) label.textContent = isLoading ? loadingLabel : defaultLabel;
  }

  function updateProofFilesCount() {
    if (!proofFilesCount || !proofFilesList) return;
    const count = selectedProofFiles.length;
    proofFilesCount.textContent = `${count} of 3 ${count === 1 ? "file" : "files"} selected.`;
    proofFilesList.replaceChildren();
    selectedProofFiles.forEach((file, index) => {
      const item = document.createElement("li");
      item.className = "selected-files__item";
      const name = document.createElement("span");
      name.className = "selected-files__name";
      name.textContent = file.name;
      const remove = document.createElement("button");
      remove.className = "selected-files__remove";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", () => {
        selectedProofFiles.splice(index, 1);
        syncProofFilesInput();
        updateProofFilesCount();
      });
      item.append(name, remove);
      proofFilesList.appendChild(item);
    });
  }

  function syncProofFilesInput() {
    if (!proofFilesInput || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    selectedProofFiles.forEach((file) => transfer.items.add(file));
    proofFilesInput.files = transfer.files;
  }

  proofFilesInput?.addEventListener("change", () => {
    const incomingFiles = Array.from(proofFilesInput.files || []);
    incomingFiles.forEach((file) => {
      const alreadySelected = selectedProofFiles.some((selected) =>
        selected.name === file.name
        && selected.size === file.size
        && selected.lastModified === file.lastModified
      );
      if (!alreadySelected && selectedProofFiles.length < 3) selectedProofFiles.push(file);
    });
    syncProofFilesInput();
    updateProofFilesCount();
  });

  function showCaseSummary(caseData) {
    loadedCaseId = caseData.case_id;
    caseSummary.innerHTML = "";
    const rows = [
      ["Case ID", caseData.case_id],
      ["Name", `${caseData.first_name} ${caseData.last_name}`],
      ["Email", caseData.email],
      ["Phone", caseData.phone],
      ["Location", `${caseData.city}, ${caseData.country}`],
      ["Loss Range", caseData.loss_range],
      ["Description", caseData.case_description],
    ];
    const list = document.createElement("dl");
    rows.forEach(([label, value]) => {
      const term = document.createElement("dt");
      const desc = document.createElement("dd");
      term.textContent = label;
      desc.textContent = value || "-";
      list.append(term, desc);
    });
    caseSummary.appendChild(list);
    caseDetails.classList.remove("hidden");
  }

  async function toBase64(file) {
    const arrayBuffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const caseId = caseIdInput.value.trim().toUpperCase();
    if (!caseId) return;
    caseIdInput.value = caseId;

    if (caseId.toUpperCase() === "PCH-2026-AB12CD") {
      showCaseSummary({
        case_id: "PCH-2026-AB12CD",
        first_name: "Sample",
        last_name: "Client",
        email: "client@example.com",
        phone: "+1 555 0100",
        city: "New York",
        country: "United States",
        loss_range: "$10,000 - $50,000",
        case_description:
          "Sample preview case for checking the verification layout before using a real case ID.",
      });
      setText(lookupStatus, "Sample case loaded. You can now preview the proof section.", "success");
      return;
    }

    setButtonLoading(lookupSubmitButton, true, "Retrieving...", "Retrieve Case");
    setText(lookupStatus, "Retrieving case...", "loading");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        },
        body: JSON.stringify({ action: "lookup", caseId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not retrieve case");

      showCaseSummary(data.case);
      setText(lookupStatus, "Case found. You can now submit supporting proof.", "success");
    } catch (err) {
      setText(lookupStatus, err.message || "Lookup failed.", "error");
    } finally {
      setButtonLoading(lookupSubmitButton, false, "Retrieving...", "Retrieve Case");
    }
  });

  proofForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!loadedCaseId) {
      setText(proofStatus, "Retrieve a case first.", "error");
      return;
    }

    const notes = document.getElementById("proofNotes").value.trim();
    const files = selectedProofFiles.slice(0, 3);

    setButtonLoading(proofSubmitButton, true, "Submitting...", "Submit Verification Proof");
    setText(proofStatus, "Submitting proof...", "loading");
    try {
      const encodedFiles = [];
      for (const file of files) {
        encodedFiles.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          content: await toBase64(file),
        });
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: "submit_proof",
          caseId: loadedCaseId,
          proofNotes: notes,
          files: encodedFiles,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Proof submission failed");

      proofForm.reset();
      selectedProofFiles = [];
      updateProofFilesCount();
      setText(proofStatus, "Proof submitted successfully. Confirmation email sent.", "success");
    } catch (err) {
      setText(proofStatus, err.message || "Submission failed.", "error");
    } finally {
      setButtonLoading(proofSubmitButton, false, "Submitting...", "Submit Verification Proof");
    }
  });
})();
