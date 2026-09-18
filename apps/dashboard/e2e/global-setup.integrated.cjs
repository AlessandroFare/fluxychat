"use strict";

const { ensureAdminJwt } = require("./admin-jwt.cjs");

module.exports = async function globalSetup() {
  const workerUrl = (process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787").replace(
    /\/$/,
    "",
  );
  await ensureAdminJwt(workerUrl);
};
