const ms = Number(process.env.SITEPM_TIMEOUT_STUB_MS ?? "5000");
await new Promise((resolve) => {
  setTimeout(resolve, ms);
});
process.stdout.write(JSON.stringify({ ok: true, stub: true }));
