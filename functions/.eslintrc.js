module.exports = {
  root: true,
  env: {
    es6: true,
    node: true, // Esta linha corrige o erro
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    quotes: ["error", "double"],
  },
};