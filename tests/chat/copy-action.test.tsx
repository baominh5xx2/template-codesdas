// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyAction } from "@/ui/chat/copy-action";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CopyAction", () => {
  it("copies the original content and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onFailure = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyAction content={"Câu trả lời\n```ts\nconst n = 1;\n```"} onFailure={onFailure} />);
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã sao chép"));
    expect(writeText).toHaveBeenCalledWith("Câu trả lời\n```ts\nconst n = 1;\n```");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it.each(["rejected", "missing"])("reports %s clipboard failures without exposing raw errors", async (mode) => {
    const onFailure = vi.fn();
    vi.stubGlobal("navigator", mode === "missing" ? {} : {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("RAW_SECRET_ERROR")) },
    });
    render(<CopyAction content="Câu trả lời" onFailure={onFailure} />);
    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }));
    await waitFor(() => expect(onFailure).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("RAW_SECRET_ERROR")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
