import React from "react";

interface BrandLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = "light",
  size = "md",
  showTagline = false,
  className = "",
}: BrandLogoProps) {
  // Dimension mapping for standard sizing
  const dimensions = {
    sm: { width: 140, height: 32 },
    md: { width: 220, height: 48 },
    lg: { width: 320, height: 70 },
    xl: { width: 440, height: 96 },
  };

  const { width, height } = dimensions[size];

  // Color mappings based on theme variant
  const isDark = variant === "dark";
  const bgRectColor = isDark ? "#2A85C8" : "#1B6CA8";
  const ballColor = "#DCF34A"; // Accent ball highlight
  const textColorMarcou = isDark ? "#FFFFFF" : "#0E2E4A";
  const textColorArena = isDark ? "#60B2EC" : "#1B6CA8";
  const taglineColor = isDark ? "#94C8F0" : "#1B6CA8";

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 940 200"
        width={width}
        height={height}
        className="w-auto h-full max-h-full"
        aria-label="Marcou Arena"
        role="img"
      >
        <title>Marcou Arena</title>
        <g transform="translate(10,12)">
          {/* Tile Icon Background */}
          <rect width="176" height="176" rx="46" fill={bgRectColor} />
          {/* Court Perspective Ellipse */}
          <ellipse
            cx="88"
            cy="147"
            rx="61"
            ry="17"
            fill="#ffffff"
            opacity="0.18"
          />
          {/* Checkmark Trait */}
          <path
            d="M43 98 L86 147 L143 69"
            fill="none"
            stroke="#ffffff"
            strokeWidth="21"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Outer circle spacing */}
          <circle cx="143" cy="69" r="26" fill={bgRectColor} />
          {/* Inner ball Accent */}
          <circle cx="143" cy="69" r="18.5" fill={ballColor} />
        </g>

        {/* Wordmark Typography */}
        <text
          x="222"
          y={showTagline ? "112" : "128"}
          fontFamily="var(--font-instrument-sans), Inter, sans-serif"
          fontSize="82"
          fontWeight="800"
          letterSpacing="-2.8"
          fill={textColorMarcou}
        >
          marcou <tspan fill={textColorArena}>arena!</tspan>
        </text>

        {/* Slogan / Tagline for Arena Owners */}
        {showTagline && (
          <text
            x="226"
            y="156"
            fontFamily="var(--font-instrument-sans), Inter, sans-serif"
            fontSize="22"
            fontWeight="700"
            letterSpacing="5.5"
            fill={taglineColor}
          >
            RESERVOU · JOGOU · FATUROU
          </text>
        )}
      </svg>
    </div>
  );
}
