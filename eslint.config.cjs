// Minimal CommonJS ESLint config to provide `ignores` for runtime when project
// uses ESM (package.json "type": "module"). This prevents the runtime warning
// about ".eslintignore" being deprecated/unsupported by providing the ignores
// directly to ESLint.
module.exports = {
    ignores: [
        "build/**/*",
        "dist/**/*",
        "node_modules/**/*",
        ".react-router/**/*",
        "**/*.d.ts",
        "src/app/components/ui/shadcn/**",
        "src/extension/**",
    ],
};
