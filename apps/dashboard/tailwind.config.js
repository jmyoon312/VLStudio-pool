/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],   // html 태그에 .dark 클래스가 붙으면 다크 모드 활성화
    content: [
        './src/**/*.{ts,tsx,js,jsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: { "2xl": "1400px" },
        },
        extend: {
            // ============================================================
            // 모든 색상은 index.css의 CSS 변수를 참조합니다.
            // 이 파일에서 색상 HEX값을 직접 수정하지 마세요.
            // index.css의 :root / .dark 블록만 수정하면 됩니다.
            // ============================================================
            colors: {
                border:           "var(--border)",
                input:            "var(--input)",
                ring:             "var(--ring)",
                background:       "var(--background)",
                foreground:       "var(--foreground)",
                primary: {
                    DEFAULT:      "var(--primary)",
                    foreground:   "var(--primary-foreground)",
                },
                secondary: {
                    DEFAULT:      "var(--secondary)",
                    foreground:   "var(--secondary-foreground)",
                },
                destructive: {
                    DEFAULT:      "var(--destructive)",
                    foreground:   "var(--destructive-foreground)",
                },
                muted: {
                    DEFAULT:      "var(--muted)",
                    foreground:   "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT:      "var(--accent)",
                    foreground:   "var(--accent-foreground)",
                },
                popover: {
                    DEFAULT:      "var(--popover)",
                    foreground:   "var(--popover-foreground)",
                },
                card: {
                    DEFAULT:      "var(--card)",
                    foreground:   "var(--card-foreground)",
                },
                // 시맨틱 상태 색상
                success: {
                    DEFAULT:      "var(--success)",
                    foreground:   "var(--success-foreground)",
                },
                warning: {
                    DEFAULT:      "var(--warning)",
                    foreground:   "var(--warning-foreground)",
                },
                info: {
                    DEFAULT:      "var(--info)",
                    foreground:   "var(--info-foreground)",
                },
                // 사이드바 전용 토큰
                sidebar: {
                    DEFAULT:      "var(--sidebar)",
                    border:       "var(--sidebar-border)",
                },
            },

            // 모든 border-radius도 CSS 변수 참조
            borderRadius: {
                lg:   "var(--radius)",
                md:   "calc(var(--radius) - 2px)",
                sm:   "calc(var(--radius) - 4px)",
                xl:   "calc(var(--radius) + 4px)",
                "2xl": "calc(var(--radius) + 12px)",
                "3xl": "calc(var(--radius) + 20px)",
                "4xl": "calc(var(--radius) + 32px)",
                full: "9999px",
            },

            // 폰트도 CSS 변수 참조
            fontFamily: {
                sans: ["var(--font-sans)", "system-ui", "sans-serif"],
                mono: ["var(--font-mono)", "monospace"],
            },

            // 그림자도 CSS 변수 참조
            boxShadow: {
                sm:     "var(--shadow-sm)",
                DEFAULT:"var(--shadow-md)",
                md:     "var(--shadow-md)",
                lg:     "var(--shadow-lg)",
                xl:     "var(--shadow-xl)",
                "2xl":  "var(--shadow-2xl)",
                inner:  "var(--shadow-inner)",
            },

            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
                "marquee": {
                    "0%":   { transform: "translateX(0%)" },
                    "100%": { transform: "translateX(-50%)" },
                },
                "fade-in": {
                    from: { opacity: 0, transform: "translateY(-4px)" },
                    to:   { opacity: 1, transform: "translateY(0)" },
                },
                "slide-up": {
                    from: { opacity: 0, transform: "translateY(8px)" },
                    to:   { opacity: 1, transform: "translateY(0)" },
                },
                "pulse-glow": {
                    "0%, 100%": { opacity: 1 },
                    "50%":      { opacity: 0.5 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up":   "accordion-up 0.2s ease-out",
                "marquee":        "marquee 30s linear infinite",
                "fade-in":        "fade-in 0.2s ease-out",
                "slide-up":       "slide-up 0.3s ease-out",
                "pulse-glow":     "pulse-glow 2s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}