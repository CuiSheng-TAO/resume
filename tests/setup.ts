import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Noto_Serif_SC: () => ({ variable: "--font-serif", className: "mock-serif" }),
  Noto_Sans_SC: () => ({ variable: "--font-sans", className: "mock-sans" }),
}));
