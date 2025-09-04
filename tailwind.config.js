/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                "app-bg": "var(--color-bg)",
                "app-fg": "var(--color-fg)",
                "app-border": "var(--color-border)",
                "app-link": "var(--color-link)",
                "app-link-hover": "var(--color-link-hover)",
            },
        },
    },
    plugins: [],
};
