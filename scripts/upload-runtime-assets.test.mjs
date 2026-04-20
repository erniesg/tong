import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadUploadCache, md5ForFile, partitionUploads, shouldSkipByPath } from "./upload-runtime-assets.mjs";

test("shouldSkipByPath catches test asset paths", () => {
  assert.equal(shouldSkipByPath("assets/test-assets/tong_prores_alpha.mov"), true);
  assert.equal(shouldSkipByPath("assets/characters/tong/tong_neutral.png"), false);
});

test("loadUploadCache returns empty object when cache missing or malformed", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tong-upload-cache-"));
  const missingPath = path.join(tempDir, "missing.json");
  assert.deepEqual(loadUploadCache(missingPath), {});

  const malformedPath = path.join(tempDir, "malformed.json");
  fs.writeFileSync(malformedPath, "{bad json", "utf8");
  assert.deepEqual(loadUploadCache(malformedPath), {});
});

test("md5ForFile returns stable checksum", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tong-upload-md5-"));
  const filePath = path.join(tempDir, "a.txt");
  fs.writeFileSync(filePath, "tong", "utf8");
  assert.equal(md5ForFile(filePath), "fbd32c35bb4c8d46f8fc02a274abf1ef");
});

test("partitionUploads skips unchanged, test files, and oversize assets", () => {
  const uploads = [
    {
      kind: "asset",
      bucketKey: "assets/characters/tong/tong_neutral.png",
      checksum: "same",
      fileSizeBytes: 10,
    },
    {
      kind: "asset",
      bucketKey: "assets/test-assets/tong_prores_alpha.mov",
      checksum: "new-a",
      fileSizeBytes: 10,
    },
    {
      kind: "asset",
      bucketKey: "assets/characters/tong/huge.png",
      checksum: "new-b",
      fileSizeBytes: 50,
    },
    {
      kind: "runtime-manifest",
      bucketKey: "runtime-assets/manifest.json",
      checksum: "new-c",
      fileSizeBytes: 1,
    },
  ];

  const result = partitionUploads(
    uploads,
    {
      "assets/characters/tong/tong_neutral.png": "same",
    },
    { maxUploadBytes: 25 },
  );

  assert.equal(result.toUpload.length, 1);
  assert.equal(result.toUpload[0].bucketKey, "runtime-assets/manifest.json");
  assert.equal(result.skippedUnchanged.length, 1);
  assert.equal(result.skippedFiltered.length, 1);
  assert.equal(result.skippedOversize.length, 1);
});
