import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoUploader } from "@/components/photo-uploader";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  readAsDataURL() {
    this.result = "data:image/jpeg;base64,portrait";
    this.onload?.();
  }
}

class MockBrowserImage {
  width = 252;
  height = 352;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    this.onload?.();
  }
}

describe("PhotoUploader", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("Image", MockBrowserImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      filter: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,processed",
    );
  });

  it("accepts a valid portrait photo without crashing and emits a processed asset", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();

    render(<PhotoUploader onPhotoChange={onPhotoChange} />);

    const input = screen.getByLabelText("上传并自动优化");
    const file = new File([new Uint8Array(39_521)], "portrait.jpg", { type: "image/jpeg" });

    await user.upload(input, file);

    await waitFor(() => {
      expect(onPhotoChange).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/is not a constructor/i)).not.toBeInTheDocument();
  });
});
