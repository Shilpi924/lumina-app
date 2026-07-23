import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SceneVisualizerSection from "../components/SceneVisualizerSection";

describe("SceneVisualizerSection", () => {
  it("renders empty visualizer cards correctly", () => {
    render(
      <SceneVisualizerSection
        selectedBook={{ title: "Neuromancer", author: "William Gibson" }}
        scenes={{}}
        onSaveScene={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText("Create a Scene Illustration")).toBeTruthy();
    expect(screen.getByPlaceholderText(/e.g. A solitary astronaut/)).toBeTruthy();
  });

  it("renders saved visualizations correctly", () => {
    const mockScenes = {
      "neuromancer-william gibson": [
        {
          id: "scene-1234",
          description: "Case in a dark alleyway",
          expandedPrompt: "A futuristic neon cyberpunk alleyway...",
          imageUrl: "https://image.pollinations.ai/prompt/cyberpunk",
          createdAt: "2026-07-23T04:00:00Z",
        },
      ],
    };

    render(
      <SceneVisualizerSection
        selectedBook={{ title: "Neuromancer", author: "William Gibson" }}
        scenes={mockScenes}
        onSaveScene={vi.fn()}
        user={{ uid: "user123" }}
      />
    );

    expect(screen.getByText("Saved Visualizations (1)")).toBeTruthy();
    expect(screen.getByText('" Case in a dark alleyway "')).toBeTruthy();
    const img = screen.getByRole("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://image.pollinations.ai/prompt/cyberpunk");
  });
});
