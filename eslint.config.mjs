import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: [".next/**", "node_modules/**", ".agents/**", ".claude/**", "next-env.d.ts", "public/pdfjs/**"] },
];

export default config;
