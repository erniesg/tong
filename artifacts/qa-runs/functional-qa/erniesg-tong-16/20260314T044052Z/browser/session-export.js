(async () => {
  const qa = window.__TONG_QA__;
  if (!qa) {
    throw new Error("window.__TONG_QA__ is unavailable. Open /game with qa_run_id and qa_trace=1.");
  }

  const payload = {
    runId: "functional-qa-validate-issue-20260314T044052Z-erniesg-tong-16",
    issueRef: "erniesg/tong#16",
    capturedAt: new Date().toISOString(),
    state: qa.getState(),
    logs: qa.getLogs()
  };

  const json = JSON.stringify(payload, null, 2);
  console.log(json);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(json);
    console.log("Copied QA export JSON to clipboard.");
  }
  return payload;
})();

