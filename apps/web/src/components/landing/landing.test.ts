import { describe, it, expect } from "vitest";
import React from "react";
import { BrandLogo } from "./brand-logo";

describe("Landing Page — Marcou Arena Branding & Assets", () => {
  it("renders BrandLogo SVG element with correct default parameters", () => {
    const logoEl = BrandLogo({ variant: "light", size: "md", showTagline: false });
    expect(logoEl).toBeDefined();
    expect(logoEl.props.className).toContain("inline-flex");

    // Check SVG child element props
    const svgChild = logoEl.props.children;
    expect(svgChild.type).toBe("svg");
    expect(svgChild.props.viewBox).toBe("0 0 940 200");
  });

  it("renders BrandLogo with tagline when showTagline is true", () => {
    const logoEl = BrandLogo({ variant: "dark", size: "lg", showTagline: true });
    const svgChild = logoEl.props.children;
    
    // Find text elements inside SVG
    const svgChildrenArray = React.Children.toArray(svgChild.props.children);
    const taglineText = svgChildrenArray.find(
      (child): child is React.ReactElement<{ y?: string; children?: unknown }> =>
        React.isValidElement(child) &&
        child.type === "text" &&
        (child.props as { y?: string }).y === "156"
    );

    expect(taglineText).toBeDefined();
    if (taglineText) {
      expect(taglineText.props.children).toBe("RESERVOU · JOGOU · FATUROU");
    }
  });

  it("supports dark theme color variant", () => {
    const logoEl = BrandLogo({ variant: "dark", size: "md" });
    const svgChild = logoEl.props.children;
    const svgChildrenArray = React.Children.toArray(svgChild.props.children);

    const groupEl = svgChildrenArray.find(
      (child: unknown) => React.isValidElement(child) && child.type === "g"
    );
    expect(groupEl).toBeDefined();
  });
});
