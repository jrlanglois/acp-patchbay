// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// What a drag that started inside VS Code leaves on the composer's drop.
// The workbench never puts a dropped workbench item's bytes on the drag —
// its shipped drag helpers set its own dataTransfer formats: an Explorer
// entry sets `text/plain` (a label, not a path), `DownloadURL`, and
// `ResourceURLs` (JSON `file://` uris); an editor tab sets `text/uri-list`,
// `application/vnd.code.uri-list`, and `CodeEditors`. This module reads
// those formats and yields host-stageable paths — the composer then sends
// `addDroppedPathContext`, the same staging as the Attach file picker.
// Chromium restricts what a drop in a cross-origin frame may read, so each
// format is tried and whatever can be read is kept; an internal drag that
// reads as nothing stays distinguishable (`opaque`) from an OS file drop,
// which carries its own File items and belongs to the bytes lane.
// Whether one of these drags arrives at all is upstream's call: the
// workbench blocks its webviews for the whole of any drag it starts, so on
// 1.146 an Explorer entry or editor tab never reaches this code (see
// composer.tsx). A cross-frame drop does, and an in-window one will once
// microsoft/vscode#182449 lifts the block.

/** uri-list payloads, standard first. */
const URI_LIST_TYPES = ["text/uri-list", "application/vnd.code.uri-list"] as const;
/** JSON payloads: a list of uris, or of objects carrying a `resource` uri. */
const JSON_TYPES = ["ResourceURLs", "CodeFiles", "CodeEditors"] as const;
// dataTransfer lowercases its types, so the marker set for “this was one of
// VS Code's own drags” compares lowercase.
const WORKBENCH_MARKERS = new Set<string>([
  ...URI_LIST_TYPES,
  ...JSON_TYPES.map((type) => type.toLowerCase()),
]);

export interface DroppedResources {
  /** Absolute paths for this machine, deduped, in drop order. */
  paths: string[];
  /** The drag carried a workbench format but nothing readable named a file
   * — so the honest next step is the file's own right-click menu. */
  opaque: boolean;
}

export function droppedResources(dataTransfer: DataTransfer): DroppedResources {
  const paths: string[] = [];
  const add = (path: string | null): void => {
    if (path !== null && !paths.includes(path)) paths.push(path);
  };
  for (const type of URI_LIST_TYPES) {
    for (const line of dataTransfer.getData(type).split(/\r?\n/)) {
      // uri-list comments ("#…" lines) carry metadata, not uris.
      const entry = line.trim();
      if (entry === "" || entry.startsWith("#")) continue;
      add(pathOfFileUri(entry));
    }
  }
  for (const type of JSON_TYPES) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataTransfer.getData(type));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      const resource = typeof entry === "string" ? entry : (entry as { resource?: unknown } | null)?.resource;
      if (typeof resource === "string") add(pathOfFileUri(resource));
    }
  }
  const fromWorkbench = dataTransfer.types.some((type) => WORKBENCH_MARKERS.has(type));
  return { paths, opaque: fromWorkbench && paths.length === 0 };
}

/** A `file://` uri → a path this host can stage. Every other scheme names
 * something the host can't see: an untitled editor has no file, a remote
 * workspace's path belongs to another machine. */
function pathOfFileUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") return null;
    const path = decodeURIComponent(url.pathname);
    // A Windows drive path arrives as /d:/…, and its letter's case is the
    // url parser's business, not the drag's: Chromium upper-cases it and Node
    // leaves it as written, so one uri would name the same file two ways in
    // two runtimes. Settled here — upper-case, the form a Windows path is
    // usually written in — so a dropped file dedupes to one path everywhere.
    const drive = /^\/([a-zA-Z]):/.exec(path);
    if (url.hostname !== "") return `\\\\${url.hostname}${path.replaceAll("/", "\\")}`; // a UNC share
    const letter = drive?.[1];
    return letter === undefined ? path : `${letter.toUpperCase()}:${path.slice(3).replaceAll("/", "\\")}`;
  } catch {
    return null; // not a uri at all — junk on the drag
  }
}
