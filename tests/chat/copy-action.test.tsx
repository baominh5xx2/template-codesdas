// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyAction } from "@/ui/chat/copy-action";

describe("CopyAction", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("copies content to clipboard and shows feedback on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const onFailure = vi.fn();

    render(<CopyAction content="Tin nhắn mẫu" onFailure={onFailure} />);

    const copyBtn = screen.getByRole("button", { name: "Sao chép" });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("Tin nhắn mẫu");
    await waitFor(() => {
      expect(screen.getByText("Đã sao chép")).toBeInTheDocument();
    });
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("calls onFailure and masks raw error without leaking it to DOM when clipboard fails", async () => {
    const onFailure = vi.fn();
    const writeText = vi.fn().mockRejectedValue(new Error("RAW_SECRET_ERROR"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyAction content="Câu trả lời" onFailure={onFailure} />);

    const copyBtn = screen.getByRole("button", { name: "Sao chép" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(onFailure).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("RAW_SECRET_ERROR")).not.toBeInTheDocument();
  });
});
