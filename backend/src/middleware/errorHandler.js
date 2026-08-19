function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Validasi gagal", details: err.errors });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ error: `Data duplikat pada field: ${err.meta?.target}` });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Data tidak ditemukan" });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Terjadi kesalahan pada server" });
}

module.exports = errorHandler;
