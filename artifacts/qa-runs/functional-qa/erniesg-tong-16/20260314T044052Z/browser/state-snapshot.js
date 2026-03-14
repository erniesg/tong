(() => {
  const qa = window.__TONG_QA__;
  if (!qa) {
    throw new Error("window.__TONG_QA__ is unavailable. Open /game with qa_run_id and qa_trace=1.");
  }

  const snapshot = qa.getState();
  console.log(JSON.stringify(snapshot, null, 2));
  return snapshot;
})();

