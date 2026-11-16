// The composer's decode of VS Code's own drag payloads: every shipped
// workbench format, a path only a Windows host can stage, and the
// unreadable case kept distinguishable from an OS file drop.
import { describe, expect, it } from "vitest";
import { droppedResources } from "../src/webview/agent-view/composer/dropped-resources";

/** A DataTransfer is only read through types/getData here, so the wire's
 * own shapes are enough to drive it. */
const transfer = (types: readonly string[], payloads: Record<string, string> = {}) =>
  ({ types, getData: (type: string) => payloads[type] ?? "" }) as unknown as DataTransfer;

describe("droppedResources", () => {
  it("decodes an editor tab drag (uri-list + the internal list)", () => {
    const got = droppedResources(transfer(
      ["text/uri-list", "codeeditors", "application/vnd.code.uri-list"],
      {
        "text/uri-list": "file:///d:/work/first.md",
        "application/vnd.code.uri-list": "file:///d:/work/first.md\r\nfile:///D:/work/second.md",
        CodeEditors: JSON.stringify([{ resource: "file:///d:/work/first.md" }]),
      },
    ));
    // One file, one path: the drive letter's case is normalised here, so the
    // same uri names the same file in Chromium (which upper-cases it) and in
    // Node (which leaves it written), and the three sources dedupe to one.
    expect(got.paths).toEqual(["D:\\work\\first.md", "D:\\work\\second.md"]);
    expect(got.opaque).toBe(false);
  });

  it("stages a UNC share as the path a Windows host reads", () => {
    const got = droppedResources(transfer(["text/uri-list"], { "text/uri-list": "file://fileserver/share/notes.md" }));
    expect(got.paths).toEqual(["\\\\fileserver\\share\\notes.md"]);
  });

  it("decodes an Explorer drag (the JSON resource list), label and DownloadURL aside", () => {
    const got = droppedResources(transfer(
      ["text/plain", "downloadurl", "resourceurls", "codefiles"],
      {
        "text/plain": "notes.md",
        DownloadURL: "binary:notes.md:file:///d:/work/notes.md",
        ResourceURLs: JSON.stringify(["file:///d:/work/notes.md"]),
      },
    ));
    expect(got.paths).toEqual(["D:\\work\\notes.md"]);
    expect(got.opaque).toBe(false);
  });

  it("says a workbench drag named nothing it could read", () => {
    const got = droppedResources(transfer(["codefiles", "resourceurls", "text/plain"]));
    expect(got.paths).toEqual([]);
    expect(got.opaque).toBe(true);
  });

  it("holds nothing against an OS file drop — that's the bytes lane's", () => {
    const got = droppedResources(transfer(["files"]));
    expect(got.paths).toEqual([]);
    expect(got.opaque).toBe(false);
  });

  it("keeps only file:// uris: untitled editors, remote paths, and junk name nothing to stage", () => {
    const got = droppedResources(transfer(
      ["text/uri-list", "resourceurls"],
      {
        "text/uri-list": "untitled:Untitled-1",
        ResourceURLs: JSON.stringify(["vscode-remote://wsl%2Bubuntu/d/home/notes.md", "not a uri", 7]),
      },
    ));
    expect(got.paths).toEqual([]);
    expect(got.opaque).toBe(true);
  });

  it("carries a path with spaces and names through their percent-encoding", () => {
    const got = droppedResources(transfer(["resourceurls"], {
      ResourceURLs: JSON.stringify(["file:///d:/work/my%20plan%20(1).md"]),
    }));
    expect(got.paths).toEqual(["D:\\work\\my plan (1).md"]);
  });
});
